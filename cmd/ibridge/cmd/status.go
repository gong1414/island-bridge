package cmd

import (
	"fmt"

	"github.com/fatih/color"
	"github.com/gong1414/island-bridge/internal/config"
	"github.com/gong1414/island-bridge/internal/ssh"
	"github.com/spf13/cobra"
)

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show island-bridge status",
	Long:  "Show the current bridge status including connection and project information",
	Run:   runStatus,
}

func init() {
	rootCmd.AddCommand(statusCmd)
}

func runStatus(cmd *cobra.Command, args []string) {
	cfg, err := config.Load()
	if err != nil {
		color.Red("Configuration: ✗ not found or invalid")
		fmt.Printf("  Error: %v\n", err)
		return
	}

	color.Blue("Configuration: ✓ loaded\n")

	// Show projects
	for _, project := range cfg.Projects {
		fmt.Printf("Project: %s\n", project.Name)
		fmt.Printf("  Local:  %s\n", project.LocalPath)
		fmt.Printf("  Remote: %s\n", project.RemotePath)
		fmt.Printf("  Mode:   %s\n", project.Mode)
		fmt.Printf("  Watch:  %t\n", project.Watch)

		// Check connection
		profile, err := cfg.GetProfile(project.Profile)
		if err != nil {
			color.Red("  Profile: ✗ %s not found\n", project.Profile)
			continue
		}

		fmt.Printf("  Profile: %s (%s@%s:%d)\n", profile.Name, profile.User, profile.Host, profile.Port)

		// Try to connect
		client, err := ssh.NewClientWithOptions(profile, ssh.ClientOptions{
			InsecureSkipHostKey: GetInsecureSkipHostKey(),
		})
		if err != nil {
			color.Red("  Connection: ✗ failed (%v)\n", err)
			continue
		}
		defer client.Close()

		color.Green("  Connection: ✓ connected\n")

		// Check remote path
		if _, err := client.Stat(project.RemotePath); err != nil {
			color.Yellow("  Remote path: ✗ does not exist\n")
		} else {
			color.Green("  Remote path: ✓ exists\n")
		}

		fmt.Println()
	}
}

