
from infrastructure.database import engine, get_db
from sqlalchemy import text


def update_schema():
    with engine.connect() as conn:
        print("Checking if columns exist...")
        try:
            # Check if google_id exists
            result = conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]
            
            if "google_id" not in columns:
                print("Adding google_id column...")
                conn.execute(text("ALTER TABLE users ADD COLUMN google_id VARCHAR(255)"))
                conn.execute(text("CREATE INDEX ix_users_google_id ON users (google_id)"))
            
            if "email" not in columns:
                print("Adding email column...")
                conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(255)"))
                conn.execute(text("CREATE INDEX ix_users_email ON users (email)"))
            
            if "avatar_url" not in columns:
                print("Adding avatar_url column...")
                conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(1024)"))
                
            print("Schema update complete.")
            
        except Exception as e:
            print(f"Error updating schema: {e}")

if __name__ == "__main__":
    update_schema()
