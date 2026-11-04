import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddBaselineEligibility1757000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE screenshot_tests ADD COLUMN baseline_eligible boolean NOT NULL DEFAULT true`,
    )
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE screenshot_tests DROP COLUMN baseline_eligible`)
  }
}
