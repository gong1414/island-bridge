package cmd

import (
	"fmt"

	"github.com/fatih/color"
	"github.com/gong1414/island-bridge/internal/config"
	"github.com/spf13/cobra"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage island-bridge configuration",
	Long:  "View and manage island-bridge configuration files",
}

var configListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all profiles and projects",
	Run:   runConfigList,
}

var configValidateCmd = &cobra.Command{
	Use:   "validate",
	Short: "Validate the configuration",
	Run:   runConfigValidate,
}

func init() {
	configCmd.AddCommand(configListCmd)
	configCmd.AddCommand(configValidateCmd)
	rootCmd.AddCommand(configCmd)
}

func runConfigList(cmd *cobra.Command, args []string) {
	cfg, err := config.Load()
	if err != nil {
		exitWithError("failed to load config", err)
	}

	color.Blue("Profiles:")
	for _, p := range cfg.Profiles {
		fmt.Printf("  - %s (%s@%s:%d)\n", p.Name, p.User, p.Host, p.Port)
	}

	fmt.Println()
	color.Blue("Projects:")
	for _, p := range cfg.Projects {
		fmt.Printf("  - %s\n", p.Name)
		fmt.Printf("      Profile:    %s\n", p.Profile)
		fmt.Printf("      Local:      %s\n", p.LocalPath)
		fmt.Printf("      Remote:     %s\n", p.RemotePath)
		fmt.Printf("      Mode:       %s\n", p.Mode)
		fmt.Printf("      Watch:      %t\n", p.Watch)
	}
}

func runConfigValidate(cmd *cobra.Command, args []string) {
	cfg, err := config.Load()
	if err != nil {
		color.Red("✗ Configuration is invalid: %v", err)
		return
	}

	// Validate profiles
	for _, p := range cfg.Profiles {
		if p.Name == "" {
			color.Red("✗ Profile missing name")
			return
		}
		if p.Host == "" {
			color.Red("✗ Profile '%s' missing host", p.Name)
			return
		}
		if p.User == "" {
			color.Red("✗ Profile '%s' missing user", p.Name)
			return
		}
	}

	// Validate projects
	for _, p := range cfg.Projects {
		if p.Name == "" {
			color.Red("✗ Project missing name")
			return
		}
		if p.Profile == "" {
			color.Red("✗ Project '%s' missing profile", p.Name)
			return
		}
		if p.LocalPath == "" {
			color.Red("✗ Project '%s' missing localPath", p.Name)
			return
		}
		if p.RemotePath == "" {
			color.Red("✗ Project '%s' missing remotePath", p.Name)
			return
		}

		// Check if profile exists
		if _, err := cfg.GetProfile(p.Profile); err != nil {
			color.Red("✗ Project '%s' references unknown profile '%s'", p.Name, p.Profile)
			return
		}
	}

	color.Green("✓ Configuration is valid")
}

