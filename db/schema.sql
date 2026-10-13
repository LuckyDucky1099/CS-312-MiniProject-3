

CREATE TABLE IF NOT EXISTS users (
  user_id  VARCHAR(255) PRIMARY KEY,
  password VARCHAR(255) NOT NULL,   
  name     VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS blogs (
  blog_id         SERIAL PRIMARY KEY,
  creator_name    VARCHAR(255) NOT NULL,
  creator_user_id VARCHAR(255) NOT NULL
                  REFERENCES users(user_id)
                  ON UPDATE CASCADE      
                  ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  body            TEXT NOT NULL,
  date_created    TIMESTAMP NOT NULL DEFAULT NOW()
);
