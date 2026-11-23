"""Export only reviewed source paths; never include Git history or local evidence."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIRS = ('pages', 'fixtures', 'common', 'utils', 'tests', 'config', 'scripts', '.github/workflows')
SOURCE_FILES = ('README.md', '.gitignore', '.env.example', 'package.json', 'package-lock.json',
                'tsconfig.json', 'playwright.config.ts', 'playwright.e2e.config.ts', 'playwright.reference.config.ts')

def source_files():
    for name in SOURCE_FILES:
        yield ROOT / name
    for name in SOURCE_DIRS:
        for path in sorted((ROOT / name).rglob('*')):
            if path.is_file() and not path.is_symlink() and path.suffix in {'.ts', '.py', '.yml', '.json'}:
                yield path

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path, help='New ZIP file outside the repository')
    output = parser.parse_args().output.resolve()
    if output.is_relative_to(ROOT):
        raise SystemExit('Choose an output path outside the repository.')
    with ZipFile(output, 'x', ZIP_DEFLATED) as archive:
        for path in source_files():
            archive.write(path, path.relative_to(ROOT))
    print(f'Exported source snapshot: {output.name}')
