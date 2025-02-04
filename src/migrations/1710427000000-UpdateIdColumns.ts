import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateIdColumns1710427000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Change hostId column type in lobby table
        await queryRunner.query(`
            ALTER TABLE "lobby" 
            ALTER COLUMN "hostId" TYPE varchar
        `);

        // Change userId column type in player table
        await queryRunner.query(`
            ALTER TABLE "player" 
            ALTER COLUMN "userId" TYPE varchar
        `);

        // Change id column type in user table
        await queryRunner.query(`
            ALTER TABLE "user" 
            ALTER COLUMN "id" TYPE varchar
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert changes if needed
        await queryRunner.query(`
            ALTER TABLE "lobby" 
            ALTER COLUMN "hostId" TYPE uuid USING hostId::uuid
        `);

        await queryRunner.query(`
            ALTER TABLE "player" 
            ALTER COLUMN "userId" TYPE uuid USING userId::uuid
        `);

        await queryRunner.query(`
            ALTER TABLE "user" 
            ALTER COLUMN "id" TYPE uuid USING id::uuid
        `);
    }
} 