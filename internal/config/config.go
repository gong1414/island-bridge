// Package config provides configuration management for rdwm
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Config represents the root configuration structure
type Config struct {
	Version  string    `json:"version"`
	Profiles []Profile `json:"profiles"`
	Projects []Project `json:"projects"`
}

// Profile represents a server profile configuration
type Profile struct {
	Name     string `json:"name"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	User     string `json:"user"`
	AuthType string `json:"authType,omitempty"` // "key" or "password"
	KeyPath  string `json:"keyPath,omitempty"`
}

// Project represents a project configuration
type Project struct {
	Name       string   `json:"name"`
	Profile    string   `json:"profile"`
	LocalPath  string   `json:"localPath"`
	RemotePath string   `json:"remotePath"`
	Mode       string   `json:"mode"`  // "one-way-local", "one-way-remote", "two-way"
	Watch      bool     `json:"watch"`
	Ignore     []string `json:"ignore"`
}

// GlobalConfigPath returns the global config file path
func GlobalConfigPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".island-bridge", "config.json")
}

// ProjectConfigPath returns the project config file path
func ProjectConfigPath() string {
	return ".island-bridge.json"
}

// Load loads configuration from global and project-level files
func Load() (*Config, error) {
	cfg := &Config{Version: "1"}

	// Try to load global config
	globalPath := GlobalConfigPath()
	if _, err := os.Stat(globalPath); err == nil {
		globalCfg, err := loadFromFile(globalPath)
		if err != nil {
			return nil, fmt.Errorf("loading global config: %w", err)
		}
		cfg = mergeConfigs(cfg, globalCfg)
	}

	// Try to load project config
	projectPath := ProjectConfigPath()
	if _, err := os.Stat(projectPath); err == nil {
		projectCfg, err := loadFromFile(projectPath)
		if err != nil {
			return nil, fmt.Errorf("loading project config: %w", err)
		}
		cfg = mergeConfigs(cfg, projectCfg)
	}

	return cfg, nil
}

func loadFromFile(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func mergeConfigs(base, overlay *Config) *Config {
	if overlay.Version != "" {
		base.Version = overlay.Version
	}
	// Merge profiles (overlay takes precedence by name)
	profileMap := make(map[string]Profile)
	for _, p := range base.Profiles {
		profileMap[p.Name] = p
	}
	for _, p := range overlay.Profiles {
		profileMap[p.Name] = p
	}
	base.Profiles = make([]Profile, 0, len(profileMap))
	for _, p := range profileMap {
		base.Profiles = append(base.Profiles, p)
	}
	// Merge projects (overlay takes precedence by name)
	projectMap := make(map[string]Project)
	for _, p := range base.Projects {
		projectMap[p.Name] = p
	}
	for _, p := range overlay.Projects {
		projectMap[p.Name] = p
	}
	base.Projects = make([]Project, 0, len(projectMap))
	for _, p := range projectMap {
		base.Projects = append(base.Projects, p)
	}
	return base
}

// Save saves the configuration to the specified path
func (c *Config) Save(path string) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// GetProfile returns a profile by name
func (c *Config) GetProfile(name string) (*Profile, error) {
	for _, p := range c.Profiles {
		if p.Name == name {
			return &p, nil
		}
	}
	return nil, fmt.Errorf("profile not found: %s", name)
}

// GetProject returns a project by name
func (c *Config) GetProject(name string) (*Project, error) {
	for _, p := range c.Projects {
		if p.Name == name {
			return &p, nil
		}
	}
	return nil, fmt.Errorf("project not found: %s", name)
}

