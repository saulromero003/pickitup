<!-- Banner -->
<p align="center">
  <img src="https://raw.githubusercontent.com/saulromero003/pickitup/main/assets/banner.png" alt="PickItUp Banner" width="100%" />
</p>

<h1 align="center">📱 PickItUp</h1>

<p align="center">
  <strong>A community-driven mobile app for local help and small jobs.</strong><br/>
  Built with <a href="https://reactnative.dev/">React Native (Expo)</a> + <a href="https://supabase.com/">Supabase</a>.
</p>

---

## 🧩 Overview

**PickItUp** connects people who need help with small local tasks to others willing to lend a hand 🤝.  
Whether it’s painting a room, fixing a light, or helping with moving boxes, PickItUp makes it easy to post, find, and apply for short-term jobs in your community.

### 👇 Example use cases
- Need someone to paint 3 walls at home 🎨  
- Looking for help cleaning your garage 🧹  
- Want to offer tutoring or delivery services 🚴‍♂️  

With PickItUp, anyone can post or apply for local tasks in just a few taps.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | React Native + Expo |
| **Backend** | Supabase |
| **Database** | PostgreSQL (managed by Supabase) |
| **Auth & Storage** | Supabase Auth & Storage |
| **Realtime & Functions** | Supabase Realtime + Edge Functions |
| **Language** | JavaScript / TypeScript |
| **Version Control** | Git + GitHub |

---

## ⚙️ Features

✅ User registration and authentication (Supabase Auth)  
✅ Post and manage small job listings (“ayuditas”)  
✅ Browse and filter available tasks  
✅ View profiles and job details  
✅ Real-time updates for new offers or matches  
✅ Upload images and manage files via Supabase Storage  

---

## 🧠 Project Structure

```

pickitup/
┣ 📂 src/
┃ ┣ 📂 components/      # Shared UI components
┃ ┣ 📂 screens/         # App screens (Home, Profile, JobList, etc.)
┃ ┣ 📂 services/        # API and Supabase integration
┃ ┣ 📂 hooks/           # Custom React hooks
┃ ┗ 📜 App.js
┣ 📜 package.json
┣ 📜 app.json
┣ 📜 README.md
┗ 📜 .gitignore

````

---

## 🧑‍💻 Getting Started

### 1️⃣ Clone the repository
```bash
git clone https://github.com/saulromero003/pickitup.git
cd pickitup
````

### 2️⃣ Install dependencies

```bash
npm install
# or
yarn install
```

### 3️⃣ Start the development server

```bash
npx expo start
```

> 🧠 Make sure you have an Expo account and the Expo Go app installed on your phone to preview the project.

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory and include your Supabase credentials:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> ⚠️ Never commit your `.env` file or secret keys to GitHub!

---

## 📸 Preview

> *Coming soon — screenshots and demo GIFs will be added here.*

---

## 👥 Team

| Name                                  | Role                                |
| ------------------------------------- | ----------------------------------- |
| **Saúl Romero Cruz**                  | Project Lead / Full-Stack Developer |
| **Sinuhe Sanchez Contreras**          | Mobile Developer                    |
| **Jesus Kevin Aguirre Acosta**        | UI/UX & Supabase Integration        |

---

## 🛡 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

> ⚠️ *This project is intended for educational and portfolio purposes only. Unauthorized commercial use is not allowed.*

---

## 🌟 Support & Feedback

If you like this project, give it a ⭐ on GitHub — it really helps us grow!
You can also open an **issue** or a **pull request** to contribute ideas or fixes.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/saulromero003">Saúl Romero Cruz</a> and team.
</p>
