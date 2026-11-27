CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK(role IN ('customer','admin')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  price integer NOT NULL CHECK(price>=0),
  stock integer NOT NULL CHECK(stock>=0),
  active boolean NOT NULL DEFAULT true,
  icon text NOT NULL DEFAULT '📦'
);

CREATE TABLE cart_items (
  user_id uuid REFERENCES users ON DELETE CASCADE,
  product_id uuid REFERENCES products,
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 99),
  PRIMARY KEY(user_id,product_id)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users,
  status text NOT NULL CHECK(status IN ('paid','shipped','delivered','return_requested','refunded','cancelled')),
  total integer NOT NULL CHECK(total>=0),
  subtotal integer NOT NULL,
  shipping integer NOT NULL,
  discount integer NOT NULL,
  address text NOT NULL,
  request_key uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id,request_key)
);

CREATE TABLE order_items (
  order_id uuid REFERENCES orders,
  product_id uuid REFERENCES products,
  name text NOT NULL,
  price integer NOT NULL,
  quantity integer NOT NULL,
  PRIMARY KEY(order_id,product_id)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid UNIQUE NOT NULL REFERENCES orders,
  amount integer NOT NULL,
  status text NOT NULL CHECK(status IN ('captured','refunded')),
  provider text NOT NULL DEFAULT 'mock'
);

CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES users,
  action text NOT NULL,
  target text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX orders_user_idx ON orders(user_id,created_at DESC);

INSERT INTO users(email,password_hash,role)
VALUES
  ('admin@example.test',crypt('Admin1234!',gen_salt('bf')),'admin'),
  ('customer@example.test',crypt('Customer1234!',gen_salt('bf')),'customer');

INSERT INTO products(slug,name,description,category,price,stock,icon)
VALUES
  ('canvas-bag','帆布托特包','耐用棉帆布，适合日常通勤。','生活',2990,20,'👜'),
  ('coffee-mug','陶瓷咖啡杯','简洁釉面，容量 350ml。','生活',1800,30,'☕'),
  ('desk-lamp','桌面台灯','柔和光线，适合阅读。','家居',5900,12,'💡'),
  ('notebook','方格笔记本','适合记录灵感。','文具',900,50,'📓'),
  ('headphones','无线耳机','轻便设计，日常聆听。','数码',8900,10,'🎧'),
  ('bottle','保温水壶','不锈钢双层结构。','生活',3200,25,'🧴');
