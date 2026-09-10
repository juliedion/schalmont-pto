/* ============================================================
   Programs & Events cards — school landing pages
   ------------------------------------------------------------
   Each school page has a <div class="program-grid" id="program-grid"
   data-school="jefferson"></div>. This script renders that grid from
   Firestore collection `program_cards` (edited at
   /admin/program-cards.html) so PTO admins can add/edit/reorder/remove
   cards without a code change.

   PROGRAM_CARDS_DEFAULTS below is the content that was hand-coded on
   each page before this existed. It's used two ways:
     1. On the public page, as an instant fallback so the grid is never
        empty/blank before Firestore responds (and still works if
        Firestore is briefly unreachable).
     2. In the admin editor, as one-click "import existing cards" seed
        data the first time a school's collection is empty.
   Once real Firestore data exists for a school, it takes over — this
   object is not "live" and won't reflect future edits.
   ============================================================ */
const PROGRAM_CARDS_DEFAULTS = {
  "jefferson": [
    {
      "id": "birthdays",
      "icon": "🎂",
      "title": "Birthdays",
      "badgeType": "active",
      "badgeText": "Active",
      "desc": "Want to celebrate your child's birthday at school? Submit the form and we'll help make it special!",
      "actions": [
        {
          "label": "Birthday Request Form →",
          "href": "https://docs.google.com/forms/d/e/1FAIpQLSfy3Cgb1EHh-b1v0Y-9AnLbT3BhsoB0vhWUWr5yV9rZryjVfA/viewform",
          "cls": "btn btn-primary"
        }
      ],
      "order": 0
    },
    {
      "id": "dance34",
      "icon": "🕺",
      "title": "3rd &amp; 4th Grade Dance",
      "badgeType": "past",
      "badgeText": "Past Event",
      "desc": "The 3rd &amp; 4th Grade Dance has passed. Check back next year for information about this fun annual event.",
      "actions": [
        {
          "label": "View Event Page →",
          "href": "glitz-and-glam-dance.html",
          "cls": "btn btn-secondary"
        },
        {
          "label": "Upload Yearbook Photos →",
          "href": "https://www.dropbox.com/request/ako7yg6d0v6i2mpy239d",
          "cls": "btn btn-primary"
        }
      ],
      "order": 1
    },
    {
      "id": "back-to-school",
      "icon": "🎒",
      "title": "Back to School",
      "badgeType": "past",
      "badgeText": "✓ Past Event",
      "desc": "Thank you for a great start to the school year! Share your photos from Back to School events below.",
      "actions": [
        {
          "label": "Upload Yearbook Photos →",
          "href": "https://www.dropbox.com/request/ako7yg6d0v6i2mpy239d",
          "cls": "btn btn-primary"
        }
      ],
      "order": 2
    },
    {
      "id": "craft-fair",
      "icon": "🎄",
      "title": "Craft Fair &amp; Lunch with Santa",
      "badgeType": "past",
      "badgeText": "✓ Past Event",
      "desc": "Thank you to everyone who joined us for the Craft Fair and Lunch with Santa! It was a wonderful holiday tradition. We look forward to seeing you next year.",
      "actions": [
        {
          "label": "Upload Yearbook Photos →",
          "href": "https://www.dropbox.com/request/ako7yg6d0v6i2mpy239d",
          "cls": "btn btn-primary"
        }
      ],
      "order": 3
    },
    {
      "id": "holiday-shoppe",
      "icon": "🎁",
      "title": "Holiday Shoppe",
      "badgeType": "past",
      "badgeText": "✓ Past Event",
      "desc": "Thank you for a wonderful Holiday Shoppe! Students had a blast shopping for their loved ones. Stay tuned for next year's event.",
      "actions": [
        {
          "label": "More Info →",
          "href": "holiday-shoppe.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 4
    },
    {
      "id": "grade3-concert",
      "icon": "🎵",
      "title": "Grade 3 Concert",
      "badgeType": "past",
      "badgeText": "✓ Past Event",
      "desc": "Thank you to all the Grade 3 performers and families who joined us! Share your concert photos below.",
      "actions": [
        {
          "label": "Upload Yearbook Photos →",
          "href": "https://www.dropbox.com/request/ako7yg6d0v6i2mpy239d",
          "cls": "btn btn-primary"
        }
      ],
      "order": 5
    },
    {
      "id": "k2-dance",
      "icon": "💃",
      "title": "K-2 Dance",
      "badgeType": "past",
      "badgeText": "✓ Past Event",
      "desc": "Thank you to everyone who came out to the K-2 Dance! We had a wonderful time celebrating with our youngest Sabres. Stay tuned for future events.",
      "actions": [
        {
          "label": "Upload Yearbook Photos →",
          "href": "https://www.dropbox.com/request/ako7yg6d0v6i2mpy239d",
          "cls": "btn btn-primary"
        }
      ],
      "order": 6
    },
    {
      "id": "picture-days",
      "icon": "📸",
      "title": "Picture Days",
      "badgeType": "past",
      "badgeText": "Info Available",
      "desc": "Thank you to all the families who participated in Picture Day! Information about ordering and retakes will be posted here when available.",
      "actions": [
        {
          "label": "Learn More →",
          "href": "picture-days.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 7
    },
    {
      "id": "kindergarten-lunch-team",
      "icon": "🥪",
      "title": "Kindergarten Lunch Team",
      "badgeType": "past",
      "badgeText": "✓ Past Event",
      "desc": "Thank you to all our incredible Kindergarten Lunch Team volunteers! Your support helped our youngest Sabres feel confident and cared for at lunchtime.",
      "actions": [
        {
          "label": "More Info →",
          "href": "kindergarten-lunch-team.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 8
    },
    {
      "id": "staff-appreciation",
      "icon": "🌟",
      "title": "Staff Appreciation Week",
      "badgeType": "past",
      "badgeText": "Past Event",
      "desc": "Thank you to everyone who helped show our Jefferson staff some appreciation with an Outback baked potato bar! Stay tuned for next year's celebration.",
      "actions": [
        {
          "label": "See Details →",
          "href": "staff-appreciation-week.html#jefferson",
          "cls": "btn btn-primary"
        }
      ],
      "order": 9
    },
    {
      "id": "trunk-or-treat",
      "icon": "🎃",
      "title": "Trunk or Treat",
      "badgeType": "past",
      "badgeText": "✓ Past Event",
      "desc": "Trunk or Treat was a great success! Thank you to all the families and volunteers who made it happen. We'll see you again next fall!",
      "actions": [
        {
          "label": "Upload Yearbook Photos →",
          "href": "https://www.dropbox.com/request/ako7yg6d0v6i2mpy239d",
          "cls": "btn btn-primary"
        }
      ],
      "order": 10
    },
    {
      "id": "turn-off-screens",
      "icon": "📵",
      "title": "Turn Off the Screens",
      "badgeType": "past",
      "badgeText": "✓ Past Event",
      "desc": "Thank you to all the families who participated in Turn Off the Screens! We hope you enjoyed some great quality time together.",
      "actions": [
        {
          "label": "Upload Yearbook Photos →",
          "href": "https://www.dropbox.com/request/ako7yg6d0v6i2mpy239d",
          "cls": "btn btn-primary"
        }
      ],
      "order": 11
    },
    {
      "id": "appreciation-days",
      "icon": "🙏",
      "title": "Appreciation Days",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "Details about upcoming teacher and staff appreciation days will be posted here. Stay tuned!",
      "actions": [
        {
          "label": "Learn More →",
          "href": "appreciation-days.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 12
    },
    {
      "id": "school-banking",
      "icon": "🏦",
      "title": "Banking",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "For questions about school banking, reach out to our Treasurer Jennifer Sitors.",
      "actions": [
        {
          "label": "Learn More →",
          "href": "school-banking.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 13
    },
    {
      "id": "book-fairs",
      "icon": "📚",
      "title": "Book Fairs",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "Book fair dates and details for Jefferson Elementary will be posted here. Check back soon!",
      "actions": [
        {
          "label": "Learn More →",
          "href": "book-fairs.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 14
    },
    {
      "id": "fundraisers",
      "icon": "💰",
      "title": "Fundraisers",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "Support Jefferson Elementary students through our fundraising programs. Every purchase helps fund programs and events.",
      "actions": [
        {
          "label": "Learn More →",
          "href": "fundraisers-jefferson.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 15
    },
    {
      "id": "grade4-concert",
      "icon": "🎵",
      "title": "Grade 4 Concert",
      "badgeType": "coming",
      "badgeText": "More Info Coming Soon",
      "desc": "The Grade 4 Concert is tonight! We hope to see you there to cheer on our talented 4th graders.",
      "actions": [],
      "order": 16
    },
    {
      "id": "incoming-k",
      "icon": "🎒",
      "title": "Incoming Kindergarten",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "Resources and events for families with children entering Kindergarten at Jefferson Elementary will be posted here.",
      "actions": [
        {
          "label": "Learn More →",
          "href": "incoming-kindergarten.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 17
    },

    {
      "id": "miscellaneous",
      "icon": "📁",
      "title": "Miscellaneous",
      "badgeType": "coming",
      "badgeText": "More Info Coming Soon",
      "desc": "Have photos from a Jefferson Elementary event not listed here? Upload them to our general photo collection!",
      "actions": [],
      "order": 19
    },
    {
      "id": "scholarships",
      "icon": "🏆",
      "title": "Scholarships",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "Information about Jefferson Elementary PTO scholarship opportunities will be posted here.",
      "actions": [
        {
          "label": "Learn More →",
          "href": "scholarships-jefferson.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 20
    },
    {
      "id": "snow-days",
      "icon": "❄️",
      "title": "Snow Days",
      "badgeType": "coming",
      "badgeText": "More Info Coming Soon",
      "desc": "Share your snow day memories with the Jefferson Elementary community! Upload your photos below.",
      "actions": [],
      "order": 21
    },
    {
      "id": "spiritwear",
      "icon": "👕",
      "title": "Spiritwear",
      "badgeType": "coming",
      "badgeText": "More Info Coming Soon",
      "desc": "Jefferson Elementary spiritwear ordering information will be posted here. Check back soon!",
      "actions": [
        {
          "label": "Shop Spiritwear →",
          "href": "shop.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 22
    },
    {
      "id": "sports-cheer",
      "icon": "🏅",
      "title": "Sports &amp; Cheer",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "Share your photos from Jefferson Elementary sports and cheerleading events! Upload them below.",
      "actions": [
        {
          "label": "Learn More →",
          "href": "sports.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 23
    },
    {
      "id": "yearbook",
      "icon": "📷",
      "title": "Yearbook",
      "badgeType": "coming",
      "badgeText": "Ordering Info Coming Soon",
      "desc": "Ordering information is coming soon. Have photos from a school event? Upload them for the yearbook &mdash; no Dropbox account needed.",
      "actions": [
        {
          "label": "📤 Upload Yearbook Photos →",
          "href": "https://www.dropbox.com/request/ako7yg6d0v6i2mpy239d",
          "cls": "btn btn-primary"
        },
        {
          "label": "View Yearbook Page →",
          "href": "yearbook-jefferson.html",
          "cls": "btn btn-secondary"
        }
      ],
      "order": 24
    }
  ],
  "woestina": [
    {
      "id": "spiritwear",
      "icon": "👕",
      "title": "Spiritwear",
      "badgeType": "active",
      "badgeText": "Shop Open",
      "desc": "Show your Woestina pride! Order Schalmont spiritwear through our online shop.",
      "actions": [
        {
          "label": "Shop Spiritwear →",
          "href": "shop.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 0
    },
    {
      "id": "yearbook",
      "icon": "📷",
      "title": "Yearbook",
      "badgeType": "active",
      "badgeText": "Photos Wanted",
      "desc": "Have photos from a Woestina Pre-K event or classroom activity? Share them for the yearbook — no Dropbox account needed. Please name your files with the event and class if you can.",
      "actions": [
        {
          "label": "📤 Upload Back to School Photos →",
          "href": "https://www.dropbox.com/request/px5b11gupoytiyeofcvo",
          "cls": "btn btn-primary"
        }
      ],
      "order": 1
    },
    {
      "id": "staff-appreciation",
      "icon": "🌟",
      "title": "Staff Appreciation Week",
      "badgeType": "past",
      "badgeText": "Past Event",
      "desc": "Thank you to everyone who helped show our Woestina staff some appreciation with an Outback baked potato bar! Stay tuned for next year's celebration.",
      "actions": [
        {
          "label": "See Details →",
          "href": "staff-appreciation-week.html#woestina",
          "cls": "btn btn-primary"
        }
      ],
      "order": 2
    },
    {
      "id": "appreciation-days",
      "icon": "🙏",
      "title": "Appreciation Days",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "Details about upcoming teacher and staff appreciation days will be posted here. Stay tuned!",
      "actions": [
        {
          "label": "Learn More →",
          "href": "appreciation-days.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 3
    },
    {
      "id": "book-fairs",
      "icon": "📚",
      "title": "Book Fairs",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "Book fair details for Woestina Pre-K will be posted here. Check back soon or follow us on social media for updates.",
      "actions": [
        {
          "label": "Learn More →",
          "href": "book-fairs.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 4
    },
    {
      "id": "fundraisers",
      "icon": "💰",
      "title": "Fundraisers",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "Support the Schalmont PTO through our ongoing fundraising programs. Every purchase helps fund programs and events for students.",
      "actions": [
        {
          "label": "Learn More →",
          "href": "fundraisers-woestina.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 5
    },
    {
      "id": "incoming-kindergarten",
      "icon": "🎒",
      "title": "Incoming Kindergarten",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "Resources for families with children entering Kindergarten — including registration, tours, and Jefferson transition info.",
      "actions": [
        {
          "label": "Learn More →",
          "href": "incoming-kindergarten.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 6
    },

    {
      "id": "picture-days",
      "icon": "📸",
      "title": "Picture Days",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "School picture day dates and ordering information will be posted here when available.",
      "actions": [
        {
          "label": "Learn More →",
          "href": "picture-days.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 8
    }
  ],
  "middle": [
    {
      "id": "yearbook",
      "icon": "📖",
      "title": "Yearbook",
      "badgeType": "active",
      "badgeText": "Order Now",
      "desc": "Order your Schalmont Middle School yearbook through Balfour. Deadline is March 31, 2026 — don't miss out!",
      "actions": [
        {
          "label": "📤 Upload Yearbook Photos →",
          "href": "https://www.dropbox.com/request/n7fxvrd8v7icteedq2sn",
          "cls": "btn btn-primary"
        },
        {
          "label": "View Yearbook Page →",
          "href": "yearbook-middle.html",
          "cls": "btn btn-secondary"
        }
      ],
      "order": 0
    },
    {
      "id": "grade5-dance",
      "icon": "💃",
      "title": "5th Grade Dance",
      "badgeType": "past",
      "badgeText": "✓ Past Event",
      "desc": "Thank you to all the 5th graders, parents, and volunteers who made the 5th Grade Dance a wonderful event! Stay tuned for future events.",
      "actions": [
        {
          "label": "Upload Yearbook Photos →",
          "href": "https://www.dropbox.com/request/n7fxvrd8v7icteedq2sn",
          "cls": "btn btn-primary"
        }
      ],
      "order": 1
    },
    {
      "id": "picture-days",
      "icon": "📸",
      "title": "Picture Days",
      "badgeType": "past",
      "badgeText": "✓ Past Event",
      "desc": "Thank you to all families who participated in Picture Day! You can still order prints through Adirondack School Portraits.",
      "actions": [
        {
          "label": "Order Through Adirondack →",
          "href": "https://adirondackschoolportraits.com/",
          "cls": "btn btn-primary"
        }
      ],
      "order": 2
    },
    {
      "id": "staff-appreciation",
      "icon": "🌟",
      "title": "Staff Appreciation Week",
      "badgeType": "past",
      "badgeText": "Past Event",
      "desc": "Thank you to everyone who helped show our Middle School staff some appreciation with an Outback baked potato bar and massage raffle! Stay tuned for next year's celebration.",
      "actions": [
        {
          "label": "See Details →",
          "href": "staff-appreciation-week.html#middle-school",
          "cls": "btn btn-primary"
        }
      ],
      "order": 3
    },
    {
      "id": "trail-of-treats",
      "icon": "🎃",
      "title": "Trail of Treats",
      "badgeType": "past",
      "badgeText": "✓ Past Event",
      "desc": "Thank you to all the volunteers and families who made Trail of Treats a magical experience for our community! We look forward to seeing you next year.",
      "actions": [
        {
          "label": "Upload Yearbook Photos →",
          "href": "https://www.dropbox.com/request/n7fxvrd8v7icteedq2sn",
          "cls": "btn btn-primary"
        }
      ],
      "order": 4
    },
    {
      "id": "dance67",
      "icon": "🎰",
      "title": "6th &amp; 7th Grade Dance",
      "badgeType": "coming",
      "badgeText": "More Info Coming Soon",
      "desc": "Casino Night! See the flyer for all event details including date, time, and ticket information.",
      "actions": [
        {
          "label": "View Event Page →",
          "href": "casinoroyale.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 5
    },
    {
      "id": "grade8-formal",
      "icon": "🎩",
      "title": "8th Grade Formal",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "The 8th Grade Formal is a special evening celebrating our 8th grade Sabres. For more information contact our event coordinator.",
      "actions": [
        {
          "label": "Learn More →",
          "href": "8th-grade-dance.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 6
    },
    {
      "id": "appreciation-days",
      "icon": "🙏",
      "title": "Appreciation Days",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "Details about upcoming teacher and staff appreciation days will be posted here. Stay tuned!",
      "actions": [
        {
          "label": "Learn More →",
          "href": "appreciation-days.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 7
    },
    {
      "id": "book-fairs",
      "icon": "📚",
      "title": "Book Fairs",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "Book fair dates and details for Schalmont Middle School will be posted here. Check back soon!",
      "actions": [
        {
          "label": "Learn More →",
          "href": "book-fairs-middle.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 8
    },
    {
      "id": "fundraisers",
      "icon": "💰",
      "title": "Fundraisers",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "Support Schalmont Middle School students through our fundraising programs.",
      "actions": [
        {
          "label": "Learn More →",
          "href": "fundraisers-middle-school.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 9
    },
    {
      "id": "sabre-nation",
      "icon": "🤝",
      "title": "Sabre Nation",
      "badgeType": "coming",
      "badgeText": "More Info Coming Soon",
      "desc": "Sabre Nation helps students in grades 6–8 develop leadership through community service. Students contribute to their school, community, and peers. Meets about once a month.",
      "actions": [],
      "order": 10
    },
    {
      "id": "spiritwear",
      "icon": "👕",
      "title": "Spiritwear",
      "badgeType": "coming",
      "badgeText": "More Info Coming Soon",
      "desc": "Middle School spiritwear ordering information will be posted here. Check back soon!",
      "actions": [
        {
          "label": "Shop Spiritwear →",
          "href": "shop.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 11
    },
    {
      "id": "sports",
      "icon": "🏅",
      "title": "Sports &amp; Athletics",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "For information about middle school sports, schedules, and registration, visit our sports page.",
      "actions": [
        {
          "label": "Learn More →",
          "href": "sports.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 12
    },
    {
      "id": "student-council",
      "icon": "🏛️",
      "title": "Student Council",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "The SMS Student Council organizes events and activities for middle school students throughout the year.",
      "actions": [
        {
          "label": "Learn More →",
          "href": "student-council.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 13
    }
  ],
  "high": [
    {
      "id": "yearbook",
      "icon": "📷",
      "title": "Yearbook",
      "badgeType": "active",
      "badgeText": "Photos Wanted",
      "desc": "Order your High School yearbook through Entourage, and share your event, club, and sports photos for the book &mdash; no Dropbox account needed.",
      "actions": [
        {
          "label": "📤 Upload Yearbook Photos →",
          "href": "https://www.dropbox.com/request/vb9r2009ld35o3fg238f",
          "cls": "btn btn-primary"
        },
        {
          "label": "View Yearbook Page →",
          "href": "yearbook-high.html",
          "cls": "btn btn-secondary"
        }
      ],
      "order": 0
    },
    {
      "id": "staff-appreciation",
      "icon": "🌟",
      "title": "Staff Appreciation Week",
      "badgeType": "past",
      "badgeText": "Past Event",
      "desc": "Thank you to everyone who helped show our High School staff some appreciation with an Outback baked potato bar and massage raffle! Stay tuned for next year's celebration.",
      "actions": [
        {
          "label": "See Details →",
          "href": "staff-appreciation-week.html#high-school",
          "cls": "btn btn-primary"
        }
      ],
      "order": 1
    },
    {
      "id": "appreciation-days",
      "icon": "🙏",
      "title": "Appreciation Days",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "Details about upcoming teacher and staff appreciation days will be posted here. Stay tuned!",
      "actions": [
        {
          "label": "Learn More →",
          "href": "appreciation-days.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 2
    },
    {
      "id": "spiritwear",
      "icon": "👕",
      "title": "Spiritwear",
      "badgeType": "coming",
      "badgeText": "More Info Coming Soon",
      "desc": "High School spiritwear ordering information will be posted here. Check back soon!",
      "actions": [
        {
          "label": "Shop Spiritwear →",
          "href": "shop.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 3
    },
    {
      "id": "sports",
      "icon": "🏅",
      "title": "Sports &amp; Athletics",
      "badgeType": "active",
      "badgeText": "Info Available",
      "desc": "For information about high school sports, schedules, and registration, visit our sports page.",
      "actions": [
        {
          "label": "Learn More →",
          "href": "sports.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 4
    }
  ]
};

(function () {
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  function actionHTML(a) {
    var external = /^https?:/.test(a.href || '');
    return '<a href="' + esc(a.href) + '" class="' + esc(a.cls || 'btn btn-primary') +
      '" style="font-size:13px;padding:8px 16px"' + (external ? ' target="_blank" rel="noopener"' : '') +
      '>' + esc(a.label) + '</a>';
  }

  function cardHTML(c) {
    var badge = c.badgeType
      ? '<span class="program-badge ' + esc(c.badgeType) + '">' + esc(c.badgeText || '') + '</span>' : '';
    var actions = (c.actions || []).map(actionHTML).join('');
    return '<div class="program-card"' + (c.id ? ' id="' + esc(c.id) + '"' : '') + '>' +
      '<div class="program-card-header"><div class="program-card-icon" aria-hidden="true">' + (c.icon || '') + '</div>' +
      '<h3 class="program-card-title">' + (c.title || '') + '</h3></div>' +
      '<div class="program-card-body">' + badge +
      '<p class="program-card-desc">' + (c.desc || '') + '</p>' +
      '<div class="program-card-actions" style="display:flex;flex-direction:column;gap:8px">' + actions + '</div>' +
      '</div></div>';
  }

  function render(el, cards) {
    el.innerHTML = cards.length ? cards.map(cardHTML).join('') : '';
  }

  function loadInto(el) {
    var school = el.dataset.school;
    var fallback = (PROGRAM_CARDS_DEFAULTS[school] || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    render(el, fallback);   // instant, no flash of empty content
    try {
      if (!window.firebase || !firebase.apps || !firebase.apps.length) return;
      firebase.firestore().collection('program_cards').where('school', '==', school).get()
        .then(function (snap) {
          if (snap.empty) return;   // keep the fallback shown
          var cards = snap.docs.map(function (d) { return d.data(); })
            .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
          render(el, cards);
        })
        .catch(function () { /* keep the fallback shown */ });
    } catch (e) { /* keep the fallback shown */ }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.program-grid[data-school]').forEach(loadInto);
  });
})();
