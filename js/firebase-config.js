/* ============================================================
   Firebase Configuration — Schalmont PTO
   ============================================================
   SETUP INSTRUCTIONS:
   1. Go to https://console.firebase.google.com
   2. Click "Add project" → name it "schalmont-pto" → Create
   3. In your project, click the </> (Web) icon to add a web app
   4. Register the app, then copy the firebaseConfig values below
   5. In the Firebase console, go to:
        Authentication → Sign-in method → Email/Password → Enable
   6. In the Firebase console, go to:
        Firestore Database → Create database → Start in production mode
        Choose a region close to you (e.g. us-east1)
   7. In Firestore → Rules tab, paste these security rules:

        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /raffle_entries/{docId} {
              allow read, write: if true;
            }
            match /massage_signups/{docId} {
              allow read: if true;
              allow create: if true;
              allow delete: if true;
              allow update: if request.auth != null
                && request.auth.token.email in ['julie@schalmontpto.com'];
            }
            match /events/{eventId} {
              allow read: if true;
              allow write: if request.auth != null
                && request.auth.token.email in
                   ['julie@schalmontpto.com'];
            }
            match /directory/{userId} {
              // Any approved signed-in user can read the directory
              allow read: if request.auth != null;
              // Users can only write/delete their own listing
              allow write: if request.auth != null && request.auth.uid == userId;
            }
            match /users/{userId} {
              // Users can read their own approval status; admins can read all
              allow read: if request.auth != null && (
                request.auth.uid == userId ||
                request.auth.token.email in ['julie@schalmontpto.com']
              );
              // New users can create their own pending record (status must be 'pending')
              allow create: if request.auth != null
                && request.auth.uid == userId
                && request.resource.data.status in ['pending', 'approved'];
              // Only admins can update/delete (approve or reject)
              allow update, delete: if request.auth != null
                && request.auth.token.email in ['julie@schalmontpto.com'];
            }
          }
        }

   To manage users (reset passwords, delete accounts, etc.):
        Authentication → Users tab in the Firebase console
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyDoXpCExMLd7TgxvkFlUKvUtGasVAaUgUo",
  authDomain: "staff-appreciation-week-c9863.firebaseapp.com",
  projectId: "staff-appreciation-week-c9863",
  storageBucket: "staff-appreciation-week-c9863.firebasestorage.app",
  messagingSenderId: "983549713367",
  appId: "1:983549713367:web:24ccef732a75c7b41c0992",
  measurementId: "G-E6VXS2618W"
};

/* ============================================================
   Admin Email Addresses
   Add the email address(es) that should be able to add and
   delete events on the calendar. Must match the email used
   to create their account on the site.
   ============================================================ */
const adminEmails = [
  "julie@schalmontpto.com"
];
