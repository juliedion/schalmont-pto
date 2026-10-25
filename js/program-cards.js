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
      "badgeType": "active",
      "badgeText": "Fri, Jan 22",
      "desc": "Friday, January 22, 7:00–9:00 PM with DJ Ketchup. 5th graders are voting on the theme: Emerald City or Sabre City! Parents, sign up if you're interested in volunteering.",
      "actions": [
        {
          "label": "Details & Volunteer →",
          "href": "5th-grade-dance.html",
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
      "icon": "🌟",
      "title": "6th &amp; 7th Grade Dance",
      "badgeType": "active",
      "badgeText": "Fri, Mar 12",
      "desc": "Friday, March 12, 2027, 7:00–9:00 PM with DJ Ketchup. The theme will be chosen by the 6th and 7th grade classes! Parents, sign up if you're interested in volunteering.",
      "actions": [
        {
          "label": "Details & Volunteer →",
          "href": "6th-7th-grade-dance.html",
          "cls": "btn btn-primary"
        }
      ],
      "order": 5
    },
    {
      "id": "grade8-formal",
      "icon": "🎩",
      "title": "8th Grade Dance",
      "badgeType": "active",
      "badgeText": "Jun 11 or 12 (TBD)",
      "desc": "Friday, June 11 or 12, 2027 (date TBD), 7:00–9:00 PM. The theme will be chosen by the 8th grade class! Parents, sign up if you're interested in volunteering.",
      "actions": [
        {
          "label": "Details & Volunteer →",
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

/* Cards kept here in the site code instead of the back office -- for something that needs to
   be up before anyone can add it in the back office. They merge in with that school's
   back-office cards, sort by date like everything else, and drop off once they end.
   `desc` is HTML. */
const PROGRAM_CARDS_EXTRA = {
  "jefferson": [
    {
      "id": "jes-holiday-food-drive-2026",
      "icon": "🎁",
      "title": "Holiday Food Drive: Holiday Boxes",
      "eventDate": "2026-10-27",
      "eventEndDate": "2026-11-25",
      "badgeType": "active",
      "badgeText": "36 boxes needed",
      "desc": "Help make the holidays brighter for those in need! Wrap a box in holiday wrapping paper for our Holiday Food Drive and drop it off at the Jefferson main office. Homeroom parents: boxes are needed this week.",
      "actions": []
    },
    {
      "id": "jes-merry-morning-2026",
      "icon": "🎅",
      "title": "A Very Merry Morning & Craft Fair",
      "eventDate": "2026-12-05",
      "eventEndDate": "2026-12-05",
      "badgeType": "active",
      "badgeText": "Sat, Dec 5",
      "desc": "<strong>A Very Merry Morning</strong> from 10 AM: pancakes, photos with Santa, holiday craft fair and shopping local.<br><strong>Jefferson's Craft Fair</strong> 10 AM – 3 PM, with a raffle.",
      "actions": [
        { "label": "Details →", "href": "craft-fair-santa.html", "cls": "btn btn-primary" }
      ]
    }
  ],
  "middle": [
    {
      "id": "ms-spirit-week-2026",
      "icon": "💚",
      "title": "Middle School Spirit Week",
      "eventDate": "2026-10-26",
      "eventEndDate": "2026-10-30",
      "badgeType": "active",
      "badgeText": "Spirit Week",
      "desc": "<strong>Mon:</strong> Cozy or Fancy<br><strong>Tue:</strong> Tourist Day<br><strong>Wed:</strong> Beach vs. Boots<br><strong>Thu:</strong> Team Sports Apparel<br><strong>Fri:</strong> Favorite Character Duo Day<br>For more details, check Schoology.",
      "actions": [
        { "label": "See Spirit Week →", "href": "/spirit-week", "cls": "btn btn-primary" }
      ]
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

  // "Fri, Oct 23 · 5:00 PM" / "Oct 5 – Oct 16" / "Now through Mon, Nov 30" -- the year only
  // when it isn't this year.
  var TODAY = (function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
  function fmtDay(ymd, withWeekday) {
    var d = new Date(ymd + 'T12:00:00');
    var o = { month: 'short', day: 'numeric' };
    if (withWeekday) o.weekday = 'short';
    if (ymd.slice(0, 4) !== TODAY.slice(0, 4)) o.year = 'numeric';
    return d.toLocaleDateString('en-US', o);
  }
  function fmtTime(hm) {
    var p = String(hm || '').split(':');
    if (p.length < 2) return '';
    var h = +p[0];
    return (h % 12 || 12) + ':' + p[1] + ' ' + (h >= 12 ? 'PM' : 'AM');
  }
  function dateLabel(c) {
    if (!c.date) return '';
    var t = fmtTime(c.time);
    if (c.end && c.end > c.date) {
      return c.date <= TODAY ? 'Now through ' + fmtDay(c.end, true) : fmtDay(c.date) + ' – ' + fmtDay(c.end);
    }
    return (c.date === TODAY ? 'Today' : fmtDay(c.date, true)) + (t ? ' · ' + t : '');
  }

  function cardHTML(c) {
    var badge = c.badgeType && c.badgeText   // an empty badge would show as a blank sliver
      ? '<span class="program-badge ' + esc(c.badgeType) + '">' + esc(c.badgeText) + '</span>' : '';
    var actions = (c.actions || []).map(actionHTML).join('');
    var when = dateLabel(c);
    return '<div class="program-card"' + (c.id ? ' id="' + esc(c.id) + '"' : '') + '>' +
      '<div class="program-card-header"><div class="program-card-icon" aria-hidden="true">' + (c.icon || '') + '</div>' +
      '<h3 class="program-card-title">' + (c.title || '') + '</h3></div>' +
      '<div class="program-card-body">' +
      (when ? '<p class="program-card-date"><span aria-hidden="true">📅</span> ' + esc(when) + '</p>' : '') + badge +
      '<p class="program-card-desc">' + (c.desc || '') + '</p>' +
      '<div class="program-card-actions" style="display:flex;flex-direction:column;gap:8px">' + actions + '</div>' +
      '</div></div>';
  }

  function render(el, cards) {
    el.innerHTML = cards.length ? cards.map(cardHTML).join('') : '';
  }

  // What's current and coming up, soonest first, each with its date. An event stays until it
  // ENDS (a month-long fundraiser shows "Now through …"), then drops off -- the page itself can
  // stay published as a record. Cards with no date (ongoing programs/clubs) come after the
  // dated ones, in their manually-set `order`.
  function sortAndFilter(cards) {
    return cards
      .filter(function (c) {
        if (c.archived) return false;
        if (c.date) return (c.end && c.end > c.date ? c.end : c.date) >= TODAY;
        return c.badgeType !== 'past';
      })
      .sort(function (a, b) {
        if (a.date && b.date) return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '') < (b.time || '') ? -1 : 1;
        if (a.date !== b.date) return a.date ? -1 : 1;
        return (a.order || 0) - (b.order || 0);
      });
  }

  // A card's date comes from its event page when it has one (the card only copied the date
  // when the page was published, so the page is the up-to-date source).
  function withDates(card, page) {
    var c = {}, k;
    for (k in card) c[k] = card[k];
    c.date = (page && page.eventDate) || card.eventDate || '';
    c.end = (page && page.eventEndDate) || card.eventEndDate || '';
    c.time = (page && page.eventTime) || card.eventTime || '';
    return c;
  }
  function pageSchools(p) {
    if (Array.isArray(p.schools) && p.schools.length) return p.schools;
    return p.school ? [p.school] : [];
  }

  function loadInto(el) {
    // data-school can name several schools: "jefferson woestina" (Woestina Pre-K is part of Jefferson).
    var schools = String(el.dataset.school).split(/[\s,]+/).filter(Boolean), school = schools[0];
    var pick = function (src) { return [].concat.apply([], schools.map(function (s) { return src[s] || []; })); };
    var extra = pick(PROGRAM_CARDS_EXTRA).map(function (c) { return withDates(c, null); });
    var seenF = {};
    var fallback = sortAndFilter(pick(PROGRAM_CARDS_DEFAULTS).map(function (c) { return withDates(c, null); }).concat(extra)
      .filter(function (c) { var k = String(c.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); if (seenF[k]) return false; seenF[k] = 1; return true; }));
    render(el, fallback);   // instant, no flash of empty content
    try {
      if (!window.firebase || !firebase.apps || !firebase.apps.length) return;
      var db = firebase.firestore();
      Promise.all([
        db.collection('program_cards').where('school', 'in', schools).get(),
        // Events shared by several schools are filed as PTO-wide cards -- pick up the ones whose
        // page is for this school (or for every school).
        db.collection('program_cards').where('school', '==', 'pto').get(),
        db.collection('pages').where('status', '==', 'published').get().catch(function () { return null; })
      ]).then(function (r) {
        var pages = null;
        if (r[2]) { pages = {}; r[2].docs.forEach(function (d) { pages[d.id] = d.data(); }); }
        var seen = {}, cards = [];
        r[0].docs.concat(r[1].docs).forEach(function (d) {
          var c = d.data(), fromPto = c.school === 'pto' && school !== 'pto';
          if (/^trunk or treat 2026$/i.test(String(c.title || '').trim())) return;   // removed from the site (Oct 2026)
          var page = c.pageId && pages ? pages[c.pageId] : null;
          // A card for a page that isn't published would lead nowhere -- leave it off.
          if (c.pageId && pages && !page) return;
          if (page && /^trunk or treat 2026$/i.test(String(page.title || '').trim())) return;
          if (fromPto) {
            var sc = page ? pageSchools(page) : [];
            if (sc.length && !sc.some(function (x) { return schools.indexOf(x) >= 0; }) && sc.indexOf('pto') < 0) return;
          }
          // Same event filed under this school AND PTO-wide: show it once.
          var key = c.pageId || String(c.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
          if (seen[key]) return;
          seen[key] = 1;
          cards.push(withDates(c, page));
        });
        if (!cards.length && r[0].empty) return;   // nothing set up yet -- keep the fallback shown
        extra.forEach(function (c) {   // a back-office card with the same title takes over from the site-kept one
          var key = String(c.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
          if (!cards.some(function (x) { return String(x.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '') === key; })) cards.push(c);
        });
        render(el, sortAndFilter(cards));
      }).catch(function () { /* keep the fallback shown */ });
    } catch (e) { /* keep the fallback shown */ }
  }

  // The date line on each card.
  (function () {
    var st = document.createElement('style');
    st.textContent = '.program-card-date{display:inline-flex;align-items:center;gap:6px;margin:0 0 10px;padding:5px 10px;' +
      'border-radius:8px;background:#eef7e6;color:#1a3d24;font-size:13.5px;font-weight:700;line-height:1.3}';
    document.head.appendChild(st);
  })();

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.program-grid[data-school]').forEach(loadInto);
  });
})();
