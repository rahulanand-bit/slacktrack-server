import { dbPool } from '../../config/db';
import type { ProjectCatalogRecord } from './models';

function mapProjectRow(row: {
  id: number;
  name: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}): ProjectCatalogRecord {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class ProjectCatalogRepository {
  async listProjects(): Promise<ProjectCatalogRecord[]> {
    const result = await dbPool.query(
      `
      SELECT id, name, active, created_at, updated_at
      FROM projects
      ORDER BY LOWER(name) ASC
      `
    );

    return result.rows.map((row) => mapProjectRow(row));
  }

  async listActiveProjects(): Promise<ProjectCatalogRecord[]> {
    const result = await dbPool.query(
      `
      SELECT id, name, active, created_at, updated_at
      FROM projects
      WHERE active = TRUE
      ORDER BY LOWER(name) ASC
      `
    );

    return result.rows.map((row) => mapProjectRow(row));
  }

  async createProject(name: string, active: boolean): Promise<ProjectCatalogRecord> {
    const result = await dbPool.query(
      `
      INSERT INTO projects (name, active)
      VALUES ($1, $2)
      ON CONFLICT (name)
      DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
      RETURNING id, name, active, created_at, updated_at
      `,
      [name, active]
    );

    return mapProjectRow(result.rows[0]);
  }

  async updateProject(id: number, input: { name?: string; active?: boolean }): Promise<ProjectCatalogRecord | null> {
    const updates: string[] = [];
    const values: Array<string | boolean | number> = [id];

    if (input.name !== undefined) {
      values.push(input.name);
      updates.push(`name = $${values.length}`);
    }

    if (input.active !== undefined) {
      values.push(input.active);
      updates.push(`active = $${values.length}`);
    }

    if (updates.length === 0) return null;

    const result = await dbPool.query(
      `
      UPDATE projects
      SET ${updates.join(', ')},
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, active, created_at, updated_at
      `,
      values
    );

    if (result.rowCount === 0) return null;
    return mapProjectRow(result.rows[0]);
  }
}
