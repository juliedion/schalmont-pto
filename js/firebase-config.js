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
            match /events/{eventId} {
              allow read: if true;
              allow write: if request.auth != null
                && request.auth.token.email in
                   ['julie@schalmontpto.com'];
            }
            match /directory/{userId} {
              // Any signed-in user can read the directory
              allow read: if request.auth != null;
              // Users can only write/delete their own listing
              allow write: if request.auth != null && request.auth.uid == userId;
            }
          }
        }

   To manage users (reset passwords, delete accounts, etc.):
        Authentication → Users tab in the Firebase console
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyCaH3Xo14pCxhxgvtg31Co2gDi1VuAHoFk",
  authDomain: "schalmont-pto.firebaseapp.com",
  projectId: "schalmont-pto",
  storageBucket: "schalmont-pto.firebasestorage.app",
  messagingSenderId: "121905023545",
  appId: "1:121905023545:web:de5aadcaff55023ca49be8",
  measurementId: "G-EYKHCN25PJ"
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
