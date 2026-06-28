# How to Add Japanese Fonts for PDF Generation

## Quick Setup Guide

To enable proper Japanese text display in PDFs, you need to add Japanese font files to this directory.

## Step-by-Step Instructions

### Option 1: Download Noto Sans CJK (Recommended - Free)

1. **Download the font files:**
   - Visit: https://fonts.google.com/noto/specimen/Noto+Sans+JP
   - Click "Download family" to get all font files
   - Or use direct links:
     - Regular: https://fonts.gstatic.com/s/notosansjp/v52/-F6jfidqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf
     - Bold: https://fonts.gstatic.com/s/notosansjp/v52/-F6jfidqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf

2. **Rename and place the files:**
   - Place the Regular font file here as: `NotoSansCJK-Regular.ttf`
   - Place the Bold font file here as: `NotoSansCJK-Bold.ttf`

### Option 2: Use System Fonts (If Available)

If you have Japanese fonts installed on your system, you can copy them:

**On Linux:**
```bash
# Copy from system fonts (example paths)
cp /usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc backend/fonts/NotoSansCJK-Regular.ttf
cp /usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc backend/fonts/NotoSansCJK-Bold.ttf
```

**On macOS:**
```bash
# Copy Hiragino Sans (if available)
cp /System/Library/Fonts/Hiragino\ Sans\ GB.ttc backend/fonts/NotoSansCJK-Regular.ttf
```

**On Windows:**
```bash
# Copy from Windows fonts directory
copy "C:\Windows\Fonts\msgothic.ttc" backend\fonts\NotoSansCJK-Regular.ttf
```

### Option 3: Manual Download

1. Download any Japanese font (TTF or OTF format) that supports CJK characters
2. Rename the files to:
   - `NotoSansCJK-Regular.ttf` (for regular text)
   - `NotoSansCJK-Bold.ttf` (for bold text)
3. Place both files in this `backend/fonts/` directory

## File Structure

After adding fonts, your directory should look like:
```
backend/
└── fonts/
    ├── NotoSansCJK-Regular.ttf  ← Required for regular text
    ├── NotoSansCJK-Bold.ttf     ← Required for bold text
    └── README.md                 ← This file
```

## Verification

After adding the fonts, restart the backend server. The system will automatically:
- ✅ Detect the font files
- ✅ Register them for PDF generation
- ✅ Use them for all Japanese text

You'll see this message in the backend logs if fonts are loaded successfully:
```
✅ Japanese font registered successfully
```

## Testing

1. Make a test ticket purchase
2. Check the generated PDF
3. Japanese text should display correctly instead of boxes (□)

## Troubleshooting

**Problem:** Fonts not loading
- ✅ Check file names are exactly: `NotoSansCJK-Regular.ttf` and `NotoSansCJK-Bold.ttf`
- ✅ Check file permissions (should be readable)
- ✅ Check backend logs for error messages

**Problem:** Still seeing boxes (□) in PDF
- ✅ Verify fonts are in the correct directory: `backend/fonts/`
- ✅ Restart the backend server after adding fonts
- ✅ Check backend logs for font registration messages

## Notes

- The system will work without fonts (using Helvetica), but Japanese text will show as boxes
- Font files can be large (several MB each) - this is normal
- TTF format is preferred, but OTF also works
- The fonts are only used for PDF generation, not for the web interface

