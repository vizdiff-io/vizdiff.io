import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Baseline schema for a fresh self-hosted database.
 *
 * Creates the full self-host schema (the shape the current entities produce via `synchronize`) and
 * a `task_queue` insert trigger that `pg_notify`s the worker so it wakes immediately on enqueue
 * rather than waiting for its periodic poll (fires for every insert, regardless of source).
 *
 * Replaces the old SaaS-to-self-host transform migration: a self-hosted install always starts from
 * an empty database, so the schema is created from scratch rather than altering a pre-existing
 * multi-tenant schema that no self-hoster has. Statements run individually because TypeORM's query
 * runner uses the single-statement protocol.
 */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = "InitialSchema1700000000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    const statements = [
      `CREATE TABLE public.github_installations (
    id integer NOT NULL,
    installation_id bigint NOT NULL,
    account_id text NOT NULL,
    account_name text NOT NULL,
    account_type text NOT NULL,
    creator_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
)`,
      `CREATE SEQUENCE public.github_installations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1`,
      `ALTER SEQUENCE public.github_installations_id_seq OWNED BY public.github_installations.id`,
      `CREATE TABLE public.projects (
    id integer NOT NULL,
    name text NOT NULL,
    token text NOT NULL,
    vcs_provider text DEFAULT 'github'::text NOT NULL,
    repo_id bigint NOT NULL,
    repo_url text NOT NULL,
    gitlab_host text,
    storybook_config jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id integer NOT NULL
)`,
      `CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1`,
      `ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id`,
      `CREATE TABLE public.screenshot_tests (
    id integer NOT NULL,
    build_number integer NOT NULL,
    build_duration_sec double precision,
    commit_sha text NOT NULL,
    branch text NOT NULL,
    base_commit_sha text,
    base_branch text,
    pr_number integer,
    upload_id text NOT NULL,
    status text NOT NULL,
    vcs_status_id bigint,
    tag text,
    total_changes integer,
    browser_version text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    project_id integer NOT NULL
)`,
      `CREATE SEQUENCE public.screenshot_tests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1`,
      `ALTER SEQUENCE public.screenshot_tests_id_seq OWNED BY public.screenshot_tests.id`,
      `CREATE TABLE public.task_queue (
    id integer NOT NULL,
    task_type text NOT NULL,
    data jsonb NOT NULL,
    locked_at timestamp with time zone,
    locked_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    screenshot_test_id integer NOT NULL
)`,
      `CREATE SEQUENCE public.task_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1`,
      `ALTER SEQUENCE public.task_queue_id_seq OWNED BY public.task_queue.id`,
      `CREATE TABLE public.test_results (
    id integer NOT NULL,
    name text NOT NULL,
    story_id text NOT NULL,
    story jsonb,
    baseline_image_url text,
    new_image_url text NOT NULL,
    diff_image_url text,
    "diffRatio" double precision,
    change_status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    screenshot_test_id integer NOT NULL
)`,
      `CREATE SEQUENCE public.test_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1`,
      `ALTER SEQUENCE public.test_results_id_seq OWNED BY public.test_results.id`,
      `CREATE TABLE public.user_github_installations (
    installation_id integer NOT NULL,
    user_id integer NOT NULL
)`,
      `CREATE TABLE public.users (
    id integer NOT NULL,
    auth_subject text NOT NULL,
    auth_provider text,
    display_name text,
    email text,
    github_id text,
    github_username text,
    github_profile jsonb,
    github_access_token text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
)`,
      `CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1`,
      `ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id`,
      `ALTER TABLE ONLY public.github_installations ALTER COLUMN id SET DEFAULT nextval('public.github_installations_id_seq'::regclass)`,
      `ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass)`,
      `ALTER TABLE ONLY public.screenshot_tests ALTER COLUMN id SET DEFAULT nextval('public.screenshot_tests_id_seq'::regclass)`,
      `ALTER TABLE ONLY public.task_queue ALTER COLUMN id SET DEFAULT nextval('public.task_queue_id_seq'::regclass)`,
      `ALTER TABLE ONLY public.test_results ALTER COLUMN id SET DEFAULT nextval('public.test_results_id_seq'::regclass)`,
      `ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass)`,
      `ALTER TABLE ONLY public.projects
    ADD CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY (id)`,
      `ALTER TABLE ONLY public.task_queue
    ADD CONSTRAINT "PK_6599b90d927d13ad2568a5ac4ac" PRIMARY KEY (id)`,
      `ALTER TABLE ONLY public.test_results
    ADD CONSTRAINT "PK_6af5df01fcd3971b362fc828296" PRIMARY KEY (id)`,
      `ALTER TABLE ONLY public.github_installations
    ADD CONSTRAINT "PK_6c4f96ba219a87cf299f5e01397" PRIMARY KEY (id)`,
      `ALTER TABLE ONLY public.screenshot_tests
    ADD CONSTRAINT "PK_8868c2b2d65a025a4944c71539f" PRIMARY KEY (id)`,
      `ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id)`,
      `ALTER TABLE ONLY public.user_github_installations
    ADD CONSTRAINT "PK_d09dcee976bd2a096b270cf381c" PRIMARY KEY (installation_id, user_id)`,
      `ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_09a2296ade1053a0cc4080bda4a" UNIQUE (github_id)`,
      `ALTER TABLE ONLY public.screenshot_tests
    ADD CONSTRAINT "UQ_41b8690acd60de840ea68a141ca" UNIQUE (upload_id)`,
      `ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_69fceff61639c5014e2c6b7306e" UNIQUE (github_username)`,
      `ALTER TABLE ONLY public.projects
    ADD CONSTRAINT "UQ_7a1518a264ef7cc25fe0a8e83a5" UNIQUE (token)`,
      `ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email)`,
      `ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_e83f7dd44dba1fcd1e20a94b734" UNIQUE (auth_subject)`,
      `CREATE INDEX "IDX_04b714eace2c7e95bce28a0571" ON public.user_github_installations USING btree (installation_id)`,
      `CREATE INDEX "IDX_8a33c925647051ca93ffdb1379" ON public.user_github_installations USING btree (user_id)`,
      `CREATE INDEX "IDX_project_id_branch" ON public.screenshot_tests USING btree (project_id, branch)`,
      `CREATE INDEX "IDX_project_id_commit_sha" ON public.screenshot_tests USING btree (project_id, commit_sha)`,
      `CREATE INDEX "IDX_repo_id" ON public.projects USING btree (repo_id)`,
      `CREATE UNIQUE INDEX "IDX_vcs_repo_host" ON public.projects USING btree (vcs_provider, repo_id, gitlab_host)`,
      `ALTER TABLE ONLY public.user_github_installations
    ADD CONSTRAINT "FK_04b714eace2c7e95bce28a05714" FOREIGN KEY (installation_id) REFERENCES public.github_installations(id) ON UPDATE CASCADE ON DELETE CASCADE`,
      `ALTER TABLE ONLY public.task_queue
    ADD CONSTRAINT "FK_45849eb2c52cc724b70fe35ac8b" FOREIGN KEY (screenshot_test_id) REFERENCES public.screenshot_tests(id) ON DELETE CASCADE`,
      `ALTER TABLE ONLY public.github_installations
    ADD CONSTRAINT "FK_5f29af04bdd8b0074fbab1648e3" FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE CASCADE`,
      `ALTER TABLE ONLY public.test_results
    ADD CONSTRAINT "FK_74a3d0021c736aacd721358fc8a" FOREIGN KEY (screenshot_test_id) REFERENCES public.screenshot_tests(id) ON DELETE CASCADE`,
      `ALTER TABLE ONLY public.user_github_installations
    ADD CONSTRAINT "FK_8a33c925647051ca93ffdb13791" FOREIGN KEY (user_id) REFERENCES public.users(id)`,
      `ALTER TABLE ONLY public.screenshot_tests
    ADD CONSTRAINT "FK_b85edac12eae7432cba7e33b6ea" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE`,
      `ALTER TABLE ONLY public.projects
    ADD CONSTRAINT "FK_bd55b203eb9f92b0c8390380010" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE`,
      `CREATE OR REPLACE FUNCTION notify_task_queue() RETURNS trigger AS $func$
BEGIN
  PERFORM pg_notify('task_queue', NEW.id::text);
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql`,
      `CREATE TRIGGER task_queue_notify_insert
  AFTER INSERT ON task_queue
  FOR EACH ROW EXECUTE FUNCTION notify_task_queue()`,
    ]
    for (const sql of statements) {
      await queryRunner.query(sql)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const statements = [
      `DROP TRIGGER IF EXISTS task_queue_notify_insert ON task_queue`,
      `DROP FUNCTION IF EXISTS notify_task_queue()`,
      `DROP TABLE IF EXISTS test_results CASCADE`,
      `DROP TABLE IF EXISTS task_queue CASCADE`,
      `DROP TABLE IF EXISTS screenshot_tests CASCADE`,
      `DROP TABLE IF EXISTS user_github_installations CASCADE`,
      `DROP TABLE IF EXISTS github_installations CASCADE`,
      `DROP TABLE IF EXISTS projects CASCADE`,
      `DROP TABLE IF EXISTS users CASCADE`,
    ]
    for (const sql of statements) {
      await queryRunner.query(sql)
    }
  }
}
