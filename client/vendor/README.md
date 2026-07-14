# Vendored dependencies

`xlsx-0.20.3.tgz` is the official SheetJS Community Edition 0.20.3 package
from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.

It is committed because SheetJS recommends vendoring for build stability and
to keep `npm ci` independent of SheetJS infrastructure.

- SHA-256: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`
- npm integrity: `sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==`

When upgrading, download the new official tarball, update both hashes here,
change the `file:` dependency in `package.json`, and regenerate the lockfile.
