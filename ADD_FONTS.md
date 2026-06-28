# How to Add Japanese Fonts - Simple Guide

## Why Add Fonts?

Currently, PDFs are generated with UTF-8 encoding, but Japanese characters may display as boxes (□) because the default Helvetica font doesn't support Japanese. Adding Japanese fonts will make all text display correctly.

## Quick Setup (3 Options)

### Option 1: Automatic Download (Easiest) ⭐

Run this command from the `backend` directory:

```bash
cd backend
./fonts/download-fonts.sh
```

This will automatically download and set up the fonts for you.

### Option 2: Manual Download

1. **Visit:** https://fonts.google.com/noto/specimen/Noto+Sans+JP
2. **Click:** "Download family" button
3. **Extract** the ZIP file
4. **Copy** these files to `backend/fonts/`:
   - Rename one Regular font to: `NotoSansCJK-Regular.ttf`
   - Rename one Bold font to: `NotoSansCJK-Bold.ttf`

### Option 3: Use System Fonts

If you already have Japanese fonts on your system, copy them:

```bash
# Example for Linux
cp /usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc backend/fonts/NotoSansCJK-Regular.ttf
cp /usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc backend/fonts/NotoSansCJK-Bold.ttf
```

## After Adding Fonts

1. **Restart the backend server:**
   ```bash
   # Stop current server (Ctrl+C or kill process)
   # Then restart:
   cd backend
   node src/index.js
   ```

2. **Verify fonts loaded:**
   - Check backend logs for: `✅ Japanese font registered successfully`
   - If you see this message, fonts are working!

3. **Test:**
   - Make a test ticket purchase
   - Check the generated PDF
   - Japanese text should display correctly

## File Locations

```
backend/
├── fonts/                          ← Font files go here
│   ├── NotoSansCJK-Regular.ttf     ← Required
│   ├── NotoSansCJK-Bold.ttf        ← Required
│   ├── download-fonts.sh            ← Auto-download script
│   └── README.md                    ← Detailed guide
└── src/
    └── utils/
        └── pdfGenerator.js          ← Uses fonts automatically
```

## Troubleshooting

**Q: Fonts not working?**
- ✅ Check file names are exactly correct (case-sensitive)
- ✅ Restart backend after adding fonts
- ✅ Check file permissions (should be readable)

**Q: Still seeing boxes (□)?**
- ✅ Verify fonts are in `backend/fonts/` directory
- ✅ Check backend logs for errors
- ✅ Make sure font files are valid TTF/OTF format

**Q: Can I use different font names?**
- Currently, the code looks for specific names. If you want to use different fonts, you'll need to update `pdfGenerator.js` with the new font names.

## Current Status

✅ UTF-8 encoding: **Working**
✅ Font auto-detection: **Working**
⚠️ Japanese display: **Needs font files** (will show boxes without fonts)

## Need Help?

- Check `backend/fonts/README.md` for detailed instructions
- Check `backend/FONT_SETUP.md` for technical details
- Backend logs will show font registration status

