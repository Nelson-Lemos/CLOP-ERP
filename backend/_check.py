from sqlalchemy import text

from app.core.database import engine

with engine.connect() as c:
    print("teste users:", c.execute(text("select count(*) from users where email like '%@teste.clop'")).scalar())
    print("teste depts:", c.execute(text("select count(*) from departments where nome like 'TESTE%'")).scalar())
    print("tables:", sorted(r[0] for r in c.execute(text("select table_name from information_schema.tables where table_schema='public'"))))
