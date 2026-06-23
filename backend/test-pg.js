import pg from 'pg';

const url = "postgresql://postgres.clqxzwvaqnhsvupzvykq:MySimplePassword123TMS@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres";

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log("Success 5432 pooler:", res.rows);
  } catch (e) {
    console.error("Error 5432 pooler:", e);
  }
  pool.end();
}

main();
