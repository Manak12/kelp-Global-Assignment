
import express from 'express';
import fs from 'fs';
import { Pool } from 'pg';

const app = express();
const pool = new Pool({
  user: 'your_username',
  host: 'your_host',
  database: 'your_database',
  password: 'your_password',
  port: 5432,
});

// Configurable location for CSV file
const CSV_FILE_PATH = 'CSV to JSON Parser\file.csv';

// Middleware to parse CSV file and upload data to PostgreSQL
app.use(express.json());

app.post('/upload', async (req, res) => {
  try {
    const jsonArray = [];
    const fileContents = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const rows = fileContents.split('\n');
    const headers = rows[0].split(',');

    for (let i = 1; i < rows.length; i++) {
      const data = rows[i].split(',');
      if (data.length === headers.length) {
        const user = {
          name: data[0] + ' ' + data[1],
          age: parseInt(data[2]),
          address: {
            line1: data[3],
            line2: data[4],
            city: data[5],
            state: data[6],
          },
        };

        const additionalInfo = {};
        for (let j = 7; j < headers.length; j++) {
          additionalInfo[headers[j]] = data[j];
        }
        user.additional_info = additionalInfo;

        jsonArray.push(user);
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertQuery = 'INSERT INTO public.users (name, age, address, additional_info) VALUES ($1, $2, $3, $4)';
      for (const user of jsonArray) {
        await client.query(insertQuery, [user.name, user.age, JSON.stringify(user.address), JSON.stringify(user.additional_info)]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.status(200).json({ message: 'Data uploaded successfully' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Calculate age distribution
app.get('/age-distribution', async (req, res) => {
  try {
    const result = await pool.query('SELECT age FROM public.users');
    const ages = result.rows.map(row => row.age);
    const ageGroups = {
      '< 20': 0,
      '20 to 40': 0,
      '40 to 60': 0,
      '> 60': 0,
    };
    for (const age of ages) {
      if (age < 20) {
        ageGroups['< 20']++;
      } else if (age >= 20 && age <= 40) {
        ageGroups['20 to 40']++;
      } else if (age > 40 && age <= 60) {
        ageGroups['40 to 60']++;
      } else {
        ageGroups['> 60']++;
      }
    }
    const totalUsers = ages.length;
    const distribution = {};
    for (const group in ageGroups) {
      distribution[group] = ((ageGroups[group] / totalUsers) * 100).toFixed(2);
    }
    res.status(200).json(distribution);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
// Serve static files
app.use(express.static('public'));