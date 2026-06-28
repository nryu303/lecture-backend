#!/bin/bash

# Script to download Noto Sans CJK fonts for PDF generation
# This script helps you add Japanese fonts automatically

FONT_DIR="$(cd "$(dirname "$0")" && pwd)"
REGULAR_FONT="$FONT_DIR/NotoSansCJK-Regular.ttf"
BOLD_FONT="$FONT_DIR/NotoSansCJK-Bold.ttf"

echo "📥 Downloading Noto Sans CJK fonts for PDF generation..."
echo ""

# Check if fonts already exist
if [ -f "$REGULAR_FONT" ] && [ -f "$BOLD_FONT" ]; then
    echo "✅ Fonts already exist!"
    echo "   Regular: $REGULAR_FONT"
    echo "   Bold: $BOLD_FONT"
    echo ""
    read -p "Do you want to download again? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping download."
        exit 0
    fi
fi

# Download Noto Sans CJK Regular
echo "📥 Downloading Regular font..."
REGULAR_URL="https://github.com/google/fonts/raw/main/ofl/notosanscjktc/NotoSansCJKtc-Regular.otf"
if command -v wget &> /dev/null; then
    wget -O "$REGULAR_FONT" "$REGULAR_URL" 2>/dev/null
elif command -v curl &> /dev/null; then
    curl -L -o "$REGULAR_FONT" "$REGULAR_URL" 2>/dev/null
else
    echo "❌ Error: Neither wget nor curl is installed."
    echo "   Please install wget or curl, or download fonts manually."
    exit 1
fi

# Download Noto Sans CJK Bold
echo "📥 Downloading Bold font..."
BOLD_URL="https://github.com/google/fonts/raw/main/ofl/notosanscjktc/NotoSansCJKtc-Bold.otf"
if command -v wget &> /dev/null; then
    wget -O "$BOLD_FONT" "$BOLD_URL" 2>/dev/null
elif command -v curl &> /dev/null; then
    curl -L -o "$BOLD_FONT" "$BOLD_URL" 2>/dev/null
fi

# Verify downloads
if [ -f "$REGULAR_FONT" ] && [ -f "$BOLD_FONT" ]; then
    echo ""
    echo "✅ Fonts downloaded successfully!"
    echo "   Regular: $REGULAR_FONT"
    echo "   Bold: $BOLD_FONT"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Restart the backend server"
    echo "   2. Test PDF generation"
    echo "   3. Check backend logs for: '✅ Japanese font registered successfully'"
else
    echo ""
    echo "⚠️  Some fonts may not have downloaded correctly."
    echo "   Please download manually from: https://fonts.google.com/noto/specimen/Noto+Sans+JP"
    echo "   Place files in: $FONT_DIR"
fi

