// Package cmd provides CLI commands for island-bridge
package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

// Version is set at build time via -ldflags
var Version = "dev"

var (
	projectName         string
	profileName         string
	insecureSkipHostKey bool
)

var rootCmd = &cobra.Command{
	Use:   "ibridge",
	Short: "Island Bridge - Connect your development islands",
	Long: `Island Bridge (ibridge) connects your local and remote development environments
like bridges connecting islands. It provides:
  - Bidirectional file synchronization between local and remote environments
  - Real-time file watching with automatic sync
  - Remote Git operations via SSH
  - Multi-server, multi-project configuration management

For more information, visit: https://github.com/gong1414/island-bridge`,
}

// Execute runs the root command
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.PersistentFlags().StringVarP(&projectName, "project", "p", "", "project name to use")
	rootCmd.PersistentFlags().StringVarP(&profileName, "profile", "P", "", "profile name to use")
	rootCmd.PersistentFlags().BoolVar(&insecureSkipHostKey, "insecure", false, "skip SSH host key verification (NOT RECOMMENDED)")

	rootCmd.AddCommand(&cobra.Command{
		Use:   "version",
		Short: "Print version information",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("ibridge version %s\n", Version)
		},
	})
}

// GetInsecureSkipHostKey returns whether to skip host key verification
func GetInsecureSkipHostKey() bool {
	return insecureSkipHostKey
}

// getProjectAndProfile returns the project and profile to use
func getProjectAndProfile() (string, string) {
	if projectName != "" {
		return projectName, profileName
	}
	// Default to first project if not specified
	return "", ""
}

func exitWithError(msg string, err error) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %s: %v\n", msg, err)
	} else {
		fmt.Fprintf(os.Stderr, "Error: %s\n", msg)
	}
	os.Exit(1)
}
