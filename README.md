# ✨ ScoreBright

A web-based student score management and export system for Thai schools — teachers upload score templates, manage student data, and export polished Excel score sheets, pulling student information directly from the school's central database.

> Built with Next.js (App Router) + Prisma + MySQL and deployed at Sukhon School.

---

## ✨ Features

- 📋 **Score template management** — upload and inspect Excel templates for score entry
- 🎓 **Student score tracking** — record and manage scores per subject/class
- 📤 **Excel export** — generate formatted `.xlsx` score sheets using ExcelJS
- 📦 **Bulk export** — zip and download multiple score sheets at once (JSZip)
- 🔐 **Admin authentication** — JWT-based login (jose) with bcrypt-hashed passwords
- 🗄️ **Dual database design** — `score_app` for score data + read-only access to `school_app` for student info

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | shadcn/ui + Tailwind CSS v4 |
| ORM | Prisma 6 |
| Database | MySQL / MariaDB |
| Auth | JWT (jose) + bcrypt |
| Excel Export | ExcelJS |
| Zip Export | JSZip |

---

## 📁 Project Structure

```
scorebright/
├── src/                    # Next.js App Router source
│   ├── app/                # Pages and API routes
│   └── components/         # UI components (shadcn/ui)
├── prisma/                 # Prisma schema and migrations
├── scripts/                # Utility scripts
│   ├── seed-admin.ts       # Seed initial admin account
│   ├── inspect-template.ts # Inspect Excel template structure
│   ├── spike-export.ts     # Export spike/test script
│   └── test-export.ts      # Export test runner
├── templates/              # Excel score template files
├── .env.example            # Environment variable template
└── package.json
```

---

## 🗄️ Database Design

ScoreBright uses two MySQL databases:

| Database | Purpose |
|----------|---------|
| `score_app` | Score data, templates, admin accounts (full access) |
| `school_app` | Central school database — student info (read-only SELECT) |

The `score_app` database user requires:
```sql
-- Full access to score_app
GRANT ALL PRIVILEGES ON score_app.* TO 'score_app'@'localhost';

-- Read-only access to school_app for student data
GRANT SELECT ON school_app.* TO 'score_app'@'localhost';

FLUSH PRIVILEGES;
```

---

## 🚀 Getting Started

### Requirements

- Node.js 18+
- MySQL 5.7+ / MariaDB
- An existing `school_app` database with student data

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/thana-boon/scorebright.git
   cd scorebright
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   ```

   Edit `.env`:
   ```env
   DATABASE_URL="mysql://score_app:YOUR_PASSWORD@localhost:3306/score_app"
   AUTH_SECRET="YOUR_64_HEX_SECRET"
   ```

   Generate `AUTH_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. Run database migrations:
   ```bash
   npx prisma migrate deploy
   ```

5. Seed admin account:
   ```bash
   npm run seed:admin
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

   App runs on `http://localhost:3001`

---

## 📄 License

This project is for educational and internal school use.

---

## 👤 Author

**thana-boon** — Teacher & Developer at Sukhon School  
GitHub: [@thana-boon](https://github.com/thana-boon)
