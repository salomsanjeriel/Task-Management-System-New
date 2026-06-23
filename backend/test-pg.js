import pg from 'pg';

const url = "postgresql://postgres.clqxzwvaqnhsvupzvykq:MySimplePassword123TMS@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log("Success 6543 pooler:", res.rows);
  } catch (e) {
    console.error("Error 6543 pooler:", e);
  }
  pool.end();
}

main();
