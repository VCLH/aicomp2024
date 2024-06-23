const express = require('express');
const sqlite3 = require('sqlite3');
const bp = require('body-parser')

async function startServer() {
  const app = express()
  app.use(bp.json())
  app.use(bp.urlencoded({ extended: true }))
  app.listen(4300, '0.0.0.0', () => {
    console.log('Server started!')
  });
  const db = new sqlite3.Database('src/backend/db.sqlite');

  app.route('/api/gamemap/list').get((req, res) => {
    const query = 'SELECT * FROM game_maps ORDER BY id DESC';
    db.all(query, [], (err, rows) => {
      res.send(rows);
    });
  });
  app.route('/api/gamemap/save').post((req, res) => {
    const query = "INSERT INTO game_maps (`description`, `data`) VALUES (?, ?)";
    const statement = db.prepare(query);
    statement.bind(req.body.description, req.body.data).run();
    res.send({});
  });
  app.route('/api/gamemap/delete').post((req, res) => {
    const query = "DELETE FROM game_maps WHERE `id` = ?";
    const statement = db.prepare(query);
    statement.bind(req.body.id).run();
    res.send({});
  });

  app.route('/api/bot/list').get((req, res) => {
    const query = 'SELECT * FROM bots ORDER BY id DESC';
    db.all(query, [], (err, rows) => {
      res.send(rows);
    });
  });
  app.route('/api/bot/save').post((req, res) => {
    const query = "INSERT INTO bots (`description`, `strategy`, `config`) VALUES (?, ?, ?)";
    const statement = db.prepare(query);
    statement.bind(req.body.description, req.body.strategy, req.body.config).run();
    res.send({});
  });
  app.route('/api/bot/delete').post((req, res) => {
    const query = "DELETE FROM bots WHERE `id` = ?";
    const statement = db.prepare(query);
    statement.bind(req.body.id).run();
    res.send({});
  });
}

startServer();
