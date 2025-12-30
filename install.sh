#!/bin/bash
# Island Bridge installer
# Usage: curl -sSL https://raw.githubusercontent.com/gong1414/island-bridge/main/install.sh | bash

set -e

REPO="gong1414/island-bridge"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"

# Detect OS and architecture
detect_platform() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    case "$ARCH" in
        x86_64|amd64) ARCH="amd64" ;;
        aarch64|arm64) ARCH="arm64" ;;
        *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    
    case "$OS" in
        linux|darwin) ;;
        mingw*|msys*|cygwin*) OS="windows" ;;
        *) echo "Unsupported OS: $OS"; exit 1 ;;
    esac
}

# Get latest release version
get_latest_version() {
    curl -sSL "https://api.github.com/repos/$REPO/releases/latest" | \
        grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/'
}

# Download and install
install() {
    detect_platform
    
    VERSION=$(get_latest_version)
    if [ -z "$VERSION" ]; then
        echo "Error: Could not get latest version"
        exit 1
    fi
    
    echo "🏝️  Installing Island Bridge $VERSION..."
    echo "    Platform: $OS-$ARCH"
    
    EXT=""
    [ "$OS" = "windows" ] && EXT=".exe"
    
    FILENAME="ibridge-${OS}-${ARCH}${EXT}"
    URL="https://github.com/$REPO/releases/download/$VERSION/$FILENAME"
    
    echo "    Downloading from: $URL"
    
    mkdir -p "$INSTALL_DIR"
    
    if command -v curl &> /dev/null; then
        curl -sSL "$URL" -o "$INSTALL_DIR/ibridge${EXT}"
    elif command -v wget &> /dev/null; then
        wget -q "$URL" -O "$INSTALL_DIR/ibridge${EXT}"
    else
        echo "Error: curl or wget required"
        exit 1
    fi
    
    chmod +x "$INSTALL_DIR/ibridge${EXT}"
    
    echo ""
    echo "✅ Island Bridge installed to $INSTALL_DIR/ibridge"
    echo ""
    
    # Check if in PATH
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        echo "⚠️  $INSTALL_DIR is not in your PATH"
        echo "   Add this to your shell config (~/.bashrc or ~/.zshrc):"
        echo ""
        echo "   export PATH=\"\$PATH:$INSTALL_DIR\""
        echo ""
    else
        echo "🌉 Run 'ibridge --help' to get started!"
    fi
}

install

