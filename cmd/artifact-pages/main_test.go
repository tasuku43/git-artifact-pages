package main

import (
	"bytes"
	"strings"
	"testing"
)

func TestRunRootHelp(t *testing.T) {
	var stdout, stderr bytes.Buffer
	if err := run(t.Context(), []string{"--help"}, &stdout, &stderr); err != nil {
		t.Fatalf("run(--help) error = %v", err)
	}
	if !strings.Contains(stdout.String(), "artifact-pages <command>") {
		t.Errorf("root help does not show the standalone CLI usage:\n%s", stdout.String())
	}
}

func TestRunBuildHelp(t *testing.T) {
	var stdout, stderr bytes.Buffer
	if err := run(t.Context(), []string{"index", "build", "--help"}, &stdout, &stderr); err != nil {
		t.Fatalf("run(index build --help) error = %v", err)
	}
	for _, expected := range []string{"artifact-pages index build [options]", "--site ID", "--source DIR", "--out DIR"} {
		if !strings.Contains(stderr.String(), expected) {
			t.Errorf("build help is missing %q:\n%s", expected, stderr.String())
		}
	}
}

func TestRunBuildRequiresSource(t *testing.T) {
	var stdout, stderr bytes.Buffer
	err := run(t.Context(), []string{"index", "build", "--site", "sre"}, &stdout, &stderr)
	if err == nil || err.Error() != "--source is required" {
		t.Fatalf("run(index build without source) error = %v, want --source is required", err)
	}
}
