// Package main provides the CLI entry point for island-bridge
package main

import (
	"os"

	"github.com/gong1414/island-bridge/cmd/ibridge/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
