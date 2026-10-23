package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
)

type Service interface {
	Root() string
	EnsureDirs(ctx context.Context, dirs ...string) error
	Save(ctx context.Context, file *multipart.FileHeader, dir, name string) (string, error)
	// Delete removes a file previously returned by Save. Missing files and
	// URLs not served from local storage are ignored.
	Delete(ctx context.Context, url string) error
}

type Local struct {
	root string
}

func NewLocal(root string) *Local {
	return &Local{root: root}
}

func (s *Local) Root() string {
	return s.root
}

func (s *Local) EnsureDirs(ctx context.Context, dirs ...string) error {
	for _, dir := range dirs {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Join(s.root, dir), 0755); err != nil {
			return err
		}
	}
	return nil
}

func (s *Local) Save(ctx context.Context, file *multipart.FileHeader, dir, name string) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if err := s.EnsureDirs(ctx, dir); err != nil {
		return "", err
	}

	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	path := filepath.Join(s.root, dir, name)
	dst, err := os.Create(path)
	if err != nil {
		return "", err
	}
	_, copyErr := io.Copy(dst, src)
	closeErr := dst.Close()
	if err := errors.Join(copyErr, closeErr); err != nil {
		_ = os.Remove(path) // don't leave a truncated file behind
		return "", err
	}
	return "/uploads/" + dir + "/" + name, nil
}

func (s *Local) Delete(ctx context.Context, url string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	rel, ok := strings.CutPrefix(url, "/uploads/")
	if !ok {
		return nil
	}
	rel = filepath.Clean(rel)
	if rel == "." || filepath.IsAbs(rel) || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return fmt.Errorf("invalid upload path %q", url)
	}
	if err := os.Remove(filepath.Join(s.root, rel)); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	return nil
}
