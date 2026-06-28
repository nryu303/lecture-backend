const { supabase } = require("./supabase");

// =====================================================================
// A thin Mongoose-compatible data layer on top of @supabase/supabase-js.
//
// Goal: let the existing controllers keep using a Mongoose-like API
//   (new Model(), Model.find/findOne/findById, doc.save(), etc.)
//   while the data actually lives in Supabase/PostgreSQL.
//
// Only the subset of Mongoose features the codebase actually uses is
// implemented. Documents are plain objects (prototype-augmented with
// save()/toObject()). Primary keys are uuid, exposed as both `id` and `_id`.
// =====================================================================

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COMMON_COLUMNS = ["id", "createdAt", "updatedAt"];

// Postgres error codes -> behaviour
const PG_INVALID_TEXT_REPRESENTATION = "22P02"; // e.g. invalid uuid -> treat as "not found"
const PG_UNIQUE_VIOLATION = "23505"; // -> mimic Mongoose duplicate-key (code 11000)

function isUuid(v) {
  return typeof v === "string" && UUID_RE.test(v);
}

function ser(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

// Translate a Supabase/Postgres error into something controllers expect.
function translateError(error) {
  if (!error) return null;
  const err = new Error(error.message || "Database error");
  err.original = error;
  if (error.code === PG_UNIQUE_VIOLATION) {
    err.code = 11000; // Mongoose duplicate key code
  } else if (error.code) {
    err.code = error.code;
  }
  return err;
}

// A Postgres uuid-cast failure (22P02) means we filtered an id column with a
// non-uuid string -> in Mongo that's simply "no match", so swallow it.
function isUuidCastError(error) {
  return (
    error &&
    error.code === PG_INVALID_TEXT_REPRESENTATION &&
    /uuid/i.test(error.message || "")
  );
}

// ---------------------------------------------------------------------
// Filter translation: Mongo-style filter -> chained Supabase query
// ---------------------------------------------------------------------
function colName(key) {
  return key === "_id" ? "id" : key;
}

function orConditionValue(v) {
  if (typeof v === "string") return `"${v.replace(/"/g, '\\"')}"`;
  if (v instanceof Date) return `"${v.toISOString()}"`;
  return v;
}

function buildOrString(orArray) {
  // orArray: [{ email: x }, { username: y }] -> 'email.eq."x",username.eq."y"'
  const parts = [];
  for (const cond of orArray) {
    for (const [key, val] of Object.entries(cond)) {
      parts.push(`${colName(key)}.eq.${orConditionValue(val)}`);
    }
  }
  return parts.join(",");
}

function applyFilter(query, filter) {
  if (!filter) return query;
  for (const [key, val] of Object.entries(filter)) {
    if (key === "$or") {
      query = query.or(buildOrString(val));
      continue;
    }
    if (key === "$and") {
      for (const sub of val) query = applyFilter(query, sub);
      continue;
    }
    const col = colName(key);
    if (
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      !(val instanceof Date)
    ) {
      if ("$in" in val) query = query.in(col, val.$in.map(ser));
      else if ("$nin" in val) query = query.not(col, "in", `(${val.$nin.map(ser).join(",")})`);
      else if ("$ne" in val) query = query.neq(col, ser(val.$ne));
      else if ("$gt" in val) query = query.gt(col, ser(val.$gt));
      else if ("$gte" in val) query = query.gte(col, ser(val.$gte));
      else if ("$lt" in val) query = query.lt(col, ser(val.$lt));
      else if ("$lte" in val) query = query.lte(col, ser(val.$lte));
      else if ("$exists" in val)
        query = val.$exists ? query.not(col, "is", null) : query.is(col, null);
      else if ("$regex" in val) {
        const pattern = val.$regex instanceof RegExp ? val.$regex.source : val.$regex;
        query = query.ilike(col, `%${pattern}%`);
      } else {
        query = query.eq(col, val); // fallback: jsonb / exact object match
      }
    } else if (val === null) {
      query = query.is(col, null);
    } else {
      query = query.eq(col, ser(val));
    }
  }
  return query;
}

// Does this filter target the id/uuid column with a non-uuid value?
// If so the row can't exist -> short-circuit to empty.
function filterHasInvalidUuid(filter) {
  if (!filter) return false;
  const idVal = filter._id !== undefined ? filter._id : filter.id;
  if (idVal === undefined) return false;
  if (idVal && typeof idVal === "object") {
    if (Array.isArray(idVal.$in)) return idVal.$in.every((v) => !isUuid(v));
    return false;
  }
  return !isUuid(idVal);
}

// ---------------------------------------------------------------------
// Projection (.select("a b c") / "-a -b") applied in JS after fetch
// ---------------------------------------------------------------------
function applyProjection(row, projection) {
  if (!row || !projection) return row;
  const tokens = projection.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return row;
  const excludes = tokens.filter((t) => t.startsWith("-")).map((t) => t.slice(1));
  const includes = tokens.filter((t) => !t.startsWith("-"));
  const out = {};
  if (excludes.length) {
    for (const [k, v] of Object.entries(row)) {
      if (!excludes.includes(k) && k !== "_id") out[k] = v;
    }
  } else {
    for (const t of includes) {
      const k = t === "_id" ? "id" : t;
      if (k in row) out[k] = row[k];
    }
    if ("id" in row) out.id = row.id;
  }
  return out;
}

// ---------------------------------------------------------------------
// Query: thenable builder returned by find()/findOne()/findById()
// ---------------------------------------------------------------------
class Query {
  constructor(model, filter, mode) {
    this.model = model;
    this.filter = filter || {};
    this.mode = mode; // 'many' | 'one'
    this._sort = null;
    this._limit = null;
    this._skip = null;
    this._projection = null;
    this._populate = null;
    this._lean = false;
  }

  sort(arg) {
    this._sort = arg;
    return this;
  }
  limit(n) {
    this._limit = n == null ? null : parseInt(n, 10);
    return this;
  }
  skip(n) {
    this._skip = n == null ? null : parseInt(n, 10);
    return this;
  }
  select(p) {
    this._projection = p;
    return this;
  }
  populate(path, select) {
    if (!this._populate) this._populate = [];
    this._populate.push({ path, select });
    return this;
  }
  lean() {
    this._lean = true;
    return this;
  }

  _orders() {
    const s = this._sort;
    if (!s) return [];
    const out = [];
    if (typeof s === "string") {
      for (const tok of s.trim().split(/\s+/).filter(Boolean)) {
        if (tok.startsWith("-")) out.push([colName(tok.slice(1)), false]);
        else out.push([colName(tok), true]);
      }
    } else if (typeof s === "object") {
      for (const [k, dir] of Object.entries(s)) {
        out.push([colName(k), dir === 1 || dir === "asc"]);
      }
    }
    return out;
  }

  async exec() {
    if (filterHasInvalidUuid(this.filter)) {
      return this.mode === "one" ? null : [];
    }

    let q = supabase.from(this.model._table).select("*");
    q = applyFilter(q, this.filter);

    for (const [col, asc] of this._orders()) {
      q = q.order(col, { ascending: asc });
    }

    const from = this._skip || 0;
    if (this._limit != null) {
      q = q.range(from, from + this._limit - 1);
    } else if (from) {
      q = q.range(from, from + 100000);
    }
    if (this.mode === "one") q = q.limit(1);

    const { data, error } = await q;
    if (error) {
      if (isUuidCastError(error)) return this.mode === "one" ? null : [];
      throw translateError(error);
    }

    let rows = data || [];
    if (this._populate) rows = await this._applyPopulate(rows);

    let docs = rows.map((r) => {
      const projected = this._projection ? applyProjection(r, this._projection) : r;
      return this._lean ? withId(projected) : this.model._hydrate(projected);
    });

    return this.mode === "one" ? docs[0] || null : docs;
  }

  async _applyPopulate(rows) {
    for (const { path, select } of this._populate) {
      const refTable = this.model._spec.refs && this.model._spec.refs[path];
      if (!refTable) continue;
      const ids = [...new Set(rows.map((r) => r[path]).filter(Boolean))];
      if (ids.length === 0) continue;
      const { data, error } = await supabase.from(refTable).select("*").in("id", ids);
      if (error) throw translateError(error);
      const map = new Map((data || []).map((d) => [d.id, d]));
      for (const r of rows) {
        const ref = map.get(r[path]);
        r[path] = ref ? withId(select ? applyProjection(ref, select) : ref) : null;
      }
    }
    return rows;
  }

  // Make the Query awaitable
  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
  catch(reject) {
    return this.exec().catch(reject);
  }
}

// ---------------------------------------------------------------------
// Document helpers
// ---------------------------------------------------------------------
function withId(row) {
  if (!row) return row;
  if (row._id === undefined && row.id !== undefined) row._id = row.id;
  return row;
}

function plain(doc) {
  const out = {};
  for (const k of Object.keys(doc)) out[k] = doc[k];
  if (doc._id === undefined && doc.id !== undefined) out._id = doc.id;
  return out;
}

// ---------------------------------------------------------------------
// createModel: build a Mongoose-like Model constructor for one table
// ---------------------------------------------------------------------
function createModel(table, spec = {}) {
  spec = {
    columns: [],
    refs: {},
    statics: {},
    preValidate: null,
    preSave: null,
    sparseNull: [],
    ...spec,
  };
  const allColumns = new Set([...spec.columns, ...COMMON_COLUMNS]);

  // Keep only real columns; convert Dates and sparse-null fields.
  function serializeForWrite(source, { forInsert } = {}) {
    const payload = {};
    for (const col of allColumns) {
      if (col === "id" && !forInsert) continue; // never update PK
      if (col === "createdAt" || col === "updatedAt") continue; // DB handles these
      if (!(col in source)) continue;
      let value = source[col];
      if (value === undefined) continue;
      if (spec.sparseNull.includes(col) && (value === "" || value === undefined)) {
        value = null;
      }
      payload[col] = ser(value);
    }
    return payload;
  }

  function Model(data = {}) {
    if (data && typeof data === "object") {
      for (const [k, v] of Object.entries(data)) this[k] = v;
    }
    withId(this);
  }

  // ---- instance methods (non-enumerable so spreads/JSON stay clean) ----
  Object.defineProperty(Model.prototype, "save", {
    value: async function () {
      if (spec.preValidate) await spec.preValidate(this);
      if (spec.preSave) await spec.preSave(this);

      if (this.id) {
        const payload = serializeForWrite(this);
        const { data, error } = await supabase
          .from(table)
          .update(payload)
          .eq("id", this.id)
          .select("*")
          .single();
        if (error) throw translateError(error);
        Object.assign(this, data);
      } else {
        const payload = serializeForWrite(this, { forInsert: true });
        delete payload.id;
        const { data, error } = await supabase
          .from(table)
          .insert(payload)
          .select("*")
          .single();
        if (error) throw translateError(error);
        Object.assign(this, data);
      }
      this._id = this.id; // id is authoritative after a write
      return this;
    },
    enumerable: false,
  });
  Object.defineProperty(Model.prototype, "toObject", {
    value: function () {
      return plain(this);
    },
    enumerable: false,
  });
  Object.defineProperty(Model.prototype, "toJSON", {
    value: function () {
      return plain(this);
    },
    enumerable: false,
  });

  // ---- internals exposed to Query ----
  Model._table = table;
  Model._spec = spec;
  Model.modelName = table;
  Model._hydrate = function (row) {
    if (!row) return row;
    const doc = Object.create(Model.prototype);
    Object.assign(doc, row);
    withId(doc);
    return doc;
  };

  // ---- read statics ----
  Model.find = (filter) => new Query(Model, filter, "many");
  Model.findOne = (filter) => new Query(Model, filter, "one");
  Model.findById = (id) => new Query(Model, { id }, "one");

  Model.countDocuments = async (filter) => {
    if (filterHasInvalidUuid(filter)) return 0;
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    q = applyFilter(q, filter);
    const { count, error } = await q;
    if (error) {
      if (isUuidCastError(error)) return 0;
      throw translateError(error);
    }
    return count || 0;
  };

  Model.distinct = async (field, filter) => {
    let q = supabase.from(table).select(colName(field));
    q = applyFilter(q, filter);
    const { data, error } = await q;
    if (error) throw translateError(error);
    return [...new Set((data || []).map((r) => r[colName(field)]).filter((v) => v != null))];
  };

  // ---- create / insert ----
  Model.create = async (data) => {
    if (Array.isArray(data)) return Model.insertMany(data);
    const doc = new Model(data);
    return doc.save();
  };

  Model.insertMany = async (arr) => {
    const payloads = [];
    for (const item of arr) {
      const doc = new Model(item);
      if (spec.preValidate) await spec.preValidate(doc);
      if (spec.preSave) await spec.preSave(doc);
      const p = serializeForWrite(doc, { forInsert: true });
      delete p.id;
      payloads.push(p);
    }
    const { data, error } = await supabase.from(table).insert(payloads).select("*");
    if (error) throw translateError(error);
    return (data || []).map((r) => Model._hydrate(r));
  };

  // ---- update ----
  function buildUpdatePayload(update) {
    // Supports plain object, $set, $unset. (Other ops handled separately.)
    const merged = {};
    for (const [k, v] of Object.entries(update)) {
      if (k === "$set") Object.assign(merged, v);
      else if (k === "$unset") {
        for (const uk of Object.keys(v)) merged[uk] = null;
      } else if (!k.startsWith("$")) merged[k] = v;
    }
    return serializeForWrite(merged);
  }

  Model.findByIdAndUpdate = async (id, update, options = {}) => {
    if (!isUuid(id)) return null;
    const payload = buildUpdatePayload(update);
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      if (error.code === "PGRST116") return null; // no row
      throw translateError(error);
    }
    return Model._hydrate(data); // returns updated doc (matches {new:true} usage)
  };

  Model.findOneAndUpdate = async (filter, update, options = {}) => {
    const existing = await Model.findOne(filter);
    if (!existing) {
      if (options.upsert) return Model.create({ ...filter, ...stripOps(update) });
      return null;
    }
    return Model.findByIdAndUpdate(existing.id, update, options);
  };

  Model.updateOne = async (filter, update) => {
    const existing = await Model.findOne(filter);
    if (!existing) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    await Model.findByIdAndUpdate(existing.id, update);
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  };

  Model.updateMany = async (filter, update) => {
    // Handle $pull (remove matching elements from jsonb arrays) via read-modify-write.
    if (update && update.$pull) {
      const rows = await Model.find(filter);
      let modified = 0;
      for (const row of rows) {
        let changed = false;
        for (const [arrField, criteria] of Object.entries(update.$pull)) {
          if (!Array.isArray(row[arrField])) continue;
          const before = row[arrField].length;
          row[arrField] = row[arrField].filter(
            (el) => !matchesCriteria(el, criteria)
          );
          if (row[arrField].length !== before) changed = true;
        }
        if (changed) {
          await row.save();
          modified++;
        }
      }
      return { acknowledged: true, matchedCount: rows.length, modifiedCount: modified };
    }

    const payload = buildUpdatePayload(update);
    let q = supabase.from(table).update(payload);
    q = applyFilter(q, filter);
    const { data, error } = await q.select("id");
    if (error) throw translateError(error);
    return {
      acknowledged: true,
      matchedCount: (data || []).length,
      modifiedCount: (data || []).length,
    };
  };

  // ---- delete ----
  Model.deleteMany = async (filter) => {
    if (filterHasInvalidUuid(filter)) return { acknowledged: true, deletedCount: 0 };
    let q = supabase.from(table).delete();
    q = applyFilter(q, filter);
    const { data, error } = await q.select("id");
    if (error) {
      if (isUuidCastError(error)) return { acknowledged: true, deletedCount: 0 };
      throw translateError(error);
    }
    return { acknowledged: true, deletedCount: (data || []).length };
  };

  Model.deleteOne = async (filter) => {
    const existing = await Model.findOne(filter);
    if (!existing) return { acknowledged: true, deletedCount: 0 };
    const { error } = await supabase.from(table).delete().eq("id", existing.id);
    if (error) throw translateError(error);
    return { acknowledged: true, deletedCount: 1 };
  };

  Model.findByIdAndDelete = async (id) => {
    if (!isUuid(id)) return null;
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw translateError(error);
    }
    return Model._hydrate(data);
  };

  Model.findOneAndDelete = async (filter) => {
    const existing = await Model.findOne(filter);
    if (!existing) return null;
    const { error } = await supabase.from(table).delete().eq("id", existing.id);
    if (error) throw translateError(error);
    return existing;
  };

  // ---- aggregate (narrow: optional $match + single $group with _id:null) ----
  Model.aggregate = async (pipeline) => {
    let matchFilter = null;
    let groupStage = null;
    for (const stage of pipeline) {
      if (stage.$match) matchFilter = stage.$match;
      if (stage.$group) groupStage = stage.$group;
    }
    let q = supabase.from(table).select("*");
    if (matchFilter) q = applyFilter(q, matchFilter);
    const { data, error } = await q;
    if (error) throw translateError(error);
    const rows = data || [];
    if (!groupStage) return rows;
    if (groupStage._id != null) {
      throw new Error("adapter.aggregate only supports $group with _id: null");
    }
    return [computeGroup(rows, groupStage)];
  };

  // ---- attach custom statics (bound to Model) ----
  for (const [name, fn] of Object.entries(spec.statics)) {
    Model[name] = fn.bind(Model);
  }

  return Model;
}

// Remove Mongo update operators, returning a flat object (used for upsert).
function stripOps(update) {
  const out = {};
  for (const [k, v] of Object.entries(update || {})) {
    if (k === "$set") Object.assign(out, v);
    else if (!k.startsWith("$")) out[k] = v;
  }
  return out;
}

// Does a jsonb array element match a $pull criteria object?
function matchesCriteria(el, criteria) {
  if (el == null) return false;
  if (typeof criteria !== "object") return el === criteria;
  return Object.entries(criteria).every(([k, v]) => el[k] === v);
}

// Compute a single-group aggregation in JS (supports the accumulators used).
function computeGroup(rows, groupStage) {
  const result = {};
  for (const [field, accExpr] of Object.entries(groupStage)) {
    if (field === "_id") continue;
    const [op, arg] = Object.entries(accExpr)[0];
    if (op === "$sum") {
      if (typeof arg === "number") {
        result[field] = rows.length * arg;
      } else if (arg && arg.$cond) {
        // $sum: { $cond: ["$boolField", 1, 0] }
        const [cond, thenV, elseV] = arg.$cond;
        const condField = String(cond).replace(/^\$/, "");
        result[field] = rows.reduce(
          (acc, r) => acc + (r[condField] ? thenV : elseV),
          0
        );
      } else {
        const f = String(arg).replace(/^\$/, "");
        result[field] = rows.reduce((acc, r) => acc + (Number(r[f]) || 0), 0);
      }
    } else if (op === "$avg") {
      const f = String(arg).replace(/^\$/, "");
      result[field] = rows.length
        ? rows.reduce((acc, r) => acc + (Number(r[f]) || 0), 0) / rows.length
        : 0;
    } else if (op === "$max") {
      const f = String(arg).replace(/^\$/, "");
      result[field] = rows.reduce(
        (acc, r) => Math.max(acc, Number(r[f]) || 0),
        -Infinity
      );
      if (result[field] === -Infinity) result[field] = 0;
    } else if (op === "$min") {
      const f = String(arg).replace(/^\$/, "");
      result[field] = rows.reduce(
        (acc, r) => Math.min(acc, Number(r[f]) || 0),
        Infinity
      );
      if (result[field] === Infinity) result[field] = 0;
    }
  }
  return result;
}

module.exports = { createModel, isUuid };
