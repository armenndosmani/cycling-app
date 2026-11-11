---
paths:
  - "backend/src/main/resources/db/migration/**"
  - "backend/src/main/java/**/*Repository.java"
  - "backend/src/main/java/**/*Entity.java"
---

# Database rules

- Schema changes only through new Flyway migrations in `backend/src/main/resources/db/migration/`, named `V<n>__<short_description>.sql` with the next free number. Never edit a migration that is already on `main`.
- Hibernate must not change the schema: keep `spring.jpa.hibernate.ddl-auto` at `validate` or `none`.
- No SQL or JPQL built by string concatenation. Use parameters.
- Personal data columns: note the retention rule in the migration comment, or list it as an open question in the spec.
- Seed and test data are fake. Never real names, emails or locations.
- PostGIS is enabled (`V2__postgis.sql`, decided 2026-11-11). Do not add other extensions without a decision in `docs/decisions.md`.
