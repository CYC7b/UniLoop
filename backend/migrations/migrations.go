// Package migrations embeds the SQL migration files so every binary ships
// with the schema it expects.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
