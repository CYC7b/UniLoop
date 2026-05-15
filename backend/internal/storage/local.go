package storage

import (
	"context"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
)

type Service interface {
	Root() string
	EnsureDirs(ctx context.Context, dirs ...string) error
	Save(ctx context.Context, file *multipart.FileHeader, dir, name string) (string, error)
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

	dst, err := os.Create(filepath.Join(s.root, dir, name))
	if err != nil {
		return "", err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return "", err
	}
	return "/uploads/" + dir + "/" + name, nil
}
