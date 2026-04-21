import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { resolveNeedCoordinates } from '../data/gujaratPlaces';
import { haversineKm } from '../utils/geo';
import { validateNeed, validateVolunteer } from '../utils/validation';
import {
  createIncident as createIncidentDoc,
  deleteIncident as deleteIncidentDoc,
  getAllIncidents,
  updateIncidentStatus,
} from './firestoreRealtime';

/* ═══════════════════════════════════════════════════════════════════════
   PER-ACCOUNT SEED DATA
   Each demo account gets its own isolated dataset.
═══════════════════════════════════════════════════════════════════════ */

const SEED = {
  "ngo@ReliefLink.org": {
    stats: { totalNeeds: 8, volunteers: 47, resolved: 12, urgent: 3 },
    needs: [
      { id:1, location:"Rajpur Village",  category:"Water Crisis",    region:"Mehsana",     priority:"urgent", volunteers:8,  assigned:3,  status:"active",   deadline:"2026-04-08" },
      { id:2, location:"Sidhpur Block",   category:"Flood Relief",    region:"Patan",       priority:"urgent", volunteers:15, assigned:10, status:"active",   deadline:"2026-04-07" },
      { id:3, location:"Harij Village",   category:"Food Shortage",   region:"Patan",       priority:"medium", volunteers:6,  assigned:2,  status:"active",   deadline:"2026-04-12" },
      { id:4, location:"Kankrej",         category:"Shelter Crisis",  region:"Banaskantha", priority:"urgent", volunteers:10, assigned:0,  status:"open",     deadline:"2026-04-06" },
      { id:5, location:"Chanasma Town",   category:"School Supplies", region:"Patan",       priority:"low",    volunteers:2,  assigned:2,  status:"resolved", deadline:"2026-03-28" },
      { id:6, location:"Vijapur",         category:"Sanitation",      region:"Mehsana",     priority:"low",    volunteers:3,  assigned:0,  status:"open",     deadline:"2026-04-15" },
      { id:7, location:"Unjha",           category:"Drought Aid",     region:"Mehsana",     priority:"medium", volunteers:5,  assigned:3,  status:"active",   deadline:"2026-04-10" },
      { id:8, location:"Vadnagar",        category:"Library Books",   region:"Mehsana",     priority:"low",    volunteers:1,  assigned:1,  status:"resolved", deadline:"2026-03-30" },
    ],
    volunteers: [
      { id:1, name:"Arjun Kumar",  initials:"AK", skill:"Water Logistics",       distance:0,  rating:5, tasks:24, points:1240, match:96, available:true,  color:"#6366F1", region:"Mehsana",     lat:23.5880, lng:72.3693 },
      { id:2, name:"Sonal Raval",  initials:"SR", skill:"Civil Engineer",        distance:0,  rating:5, tasks:17, points:850,  match:79, available:true,  color:"#F59E0B", region:"Mehsana",     lat:23.6997, lng:72.5469 },
      { id:3, name:"Rohit Desai",  initials:"RD", skill:"Logistics & Transport", distance:0,  rating:4, tasks:15, points:720,  match:67, available:false, color:"#16A34A", region:"Banaskantha", lat:24.1725, lng:72.4383 },
      { id:4, name:"Vijay Patel",  initials:"VP", skill:"Water Engineer",        distance:0, rating:5, tasks:11, points:530,  match:58, available:true,  color:"#7C3AED", region:"Mehsana",     lat:23.8002, lng:72.3925 },
      { id:5, name:"Dev Pandya",   initials:"DP", skill:"Medical Doctor",        distance:0,  rating:5, tasks:8,  points:390,  match:48, available:false, color:"#059669", region:"Mehsana",     lat:23.7861, lng:72.6361 },
    ],
    notifications: [
      { id:1, type:"urgent",  title:"Critical: Water Crisis in Rajpur",          body:"3 villages affected — 4,200 people without water. 8 volunteers needed.",     time:"2 min ago",  read:false },
      { id:2, type:"task",    title:"Task Assigned: Arjun Kumar → Water Dist.",   body:"96% AI-match deployed. ETA 45 min to Rajpur Village.",                       time:"18 min ago", read:false },
      { id:3, type:"upload",  title:"Upload Complete: survey_rajpur_march.csv",   body:"142 records processed. 3 urgent needs auto-identified by AI.",               time:"1 hr ago",   read:false },
      { id:4, type:"success", title:"Resolved: School Supplies — Chanasma",       body:"Sonal Raval & team delivered. 320 students benefited.",                      time:"3 hrs ago",  read:true  },
      { id:5, type:"info",    title:"New Volunteer: Vijay Patel joined",          body:"Water Engineer added to Mehsana pool.",                                      time:"5 hrs ago",  read:true  },
      { id:6, type:"report",  title:"Weekly Report — March 2026 ready",           body:"12 needs resolved, 680 volunteer hours logged. Resolution rate up 14%.",     time:"Yesterday",  read:true  },
    ],
    uploads: [
      { id:1, file:"survey_rajpur_march.csv",    village:"Rajpur",    issue:"Water Supply",  records:142, date:"Today 9:12 AM", status:"done"       },
      { id:2, file:"form_sidhpur_scan.pdf",      village:"Sidhpur",   issue:"Flood Relief",  records:89,  date:"Today 8:45 AM", status:"processing" },
      { id:3, file:"survey_kankrej_shelter.xlsx",village:"Kankrej",   issue:"Shelter",       records:210, date:"Yesterday",     status:"done"       },
      { id:4, file:"voice_unjha_drought.mp3",    village:"Unjha",     issue:"Drought Aid",   records:37,  date:"2 days ago",    status:"done"       },
    ],
    chartData: {
      categories: [
        { label:"Water",   value:38, color:"#2563EB" }, { label:"Food",    value:22, color:"#F59E0B" },
        { label:"Shelter", value:18, color:"#7C3AED" }, { label:"Sanit.",  value:12, color:"#0891B2" },
        { label:"Edu.",    value:9,  color:"#16A34A" }, { label:"Other",   value:5,  color:"#94A3B8" },
      ],
      regions: [{ label:"Mehsana",value:42 },{ label:"Patan",value:31 },{ label:"Banaskantha",value:21 },{ label:"Sabarkantha",value:6 }],
      trends:  [{ month:"Oct",value:28 },{ month:"Nov",value:22 },{ month:"Dec",value:35 },{ month:"Jan",value:30 },{ month:"Feb",value:40 },{ month:"Mar",value:47 }],
      resolution:[{ label:"Water",value:72 },{ label:"Food",value:55 },{ label:"Shelter",value:40 },{ label:"Edu.",value:88 },{ label:"Sanit.",value:30 }],
    },
  },

  "care@gujarat.org": {
    stats: { totalNeeds: 6, volunteers: 22, resolved: 8, urgent: 1 },
    needs: [
      { id:1, location:"Patan City",      category:"Medical Camp",      region:"Patan",    priority:"medium", volunteers:6,  assigned:4, status:"active",   deadline:"2026-04-10" },
      { id:2, location:"Siddhpur Town",   category:"Maternal Health",   region:"Patan",    priority:"urgent", volunteers:4,  assigned:1, status:"active",   deadline:"2026-04-07" },
      { id:3, location:"Sami Village",    category:"Vaccination Drive", region:"Patan",    priority:"medium", volunteers:3,  assigned:3, status:"resolved", deadline:"2026-04-01" },
      { id:4, location:"Harij Village",   category:"Eye Camp",          region:"Patan",    priority:"low",    volunteers:2,  assigned:0, status:"open",     deadline:"2026-04-18" },
      { id:5, location:"Chanasma",        category:"Mental Health",     region:"Patan",    priority:"medium", volunteers:3,  assigned:1, status:"active",   deadline:"2026-04-14" },
      { id:6, location:"Radhanpur",       category:"Blood Donation",    region:"Patan",    priority:"low",    volunteers:2,  assigned:2, status:"resolved", deadline:"2026-03-29" },
    ],
    volunteers: [
      { id:1, name:"Priya Mehta",   initials:"PM", skill:"Medical & First Aid",  distance:0,  rating:4, tasks:19, points:980,  match:91, available:true,  color:"#EC4899", region:"Patan", lat:23.8493, lng:72.1266 },
      { id:2, name:"Neha Kaur",    initials:"NK", skill:"Social Worker",          distance:0,  rating:4, tasks:12, points:590,  match:78, available:true,  color:"#0891B2", region:"Patan", lat:23.9161, lng:72.3802 },
      { id:3, name:"Dev Pandya",   initials:"DP", skill:"Medical Doctor",         distance:0,  rating:5, tasks:8,  points:390,  match:95, available:true,  color:"#059669", region:"Patan", lat:23.7134, lng:72.1127 },
      { id:4, name:"Meena Joshi",  initials:"MJ", skill:"Nurse & Healthcare",     distance:0,  rating:4, tasks:14, points:670,  match:88, available:false, color:"#DB2777", region:"Patan", lat:23.7000, lng:71.7833 },
      { id:5, name:"Rajan Vora",   initials:"RV", skill:"Community Health Worker",distance:0,  rating:3, tasks:6,  points:280,  match:62, available:true,  color:"#F59E0B", region:"Patan", lat:23.8333, lng:71.6000 },
    ],
    notifications: [
      { id:1, type:"urgent",  title:"Maternal Health Alert — Siddhpur",          body:"4 expecting mothers flagged critical. Dr. Dev Pandya notified.",              time:"5 min ago",  read:false },
      { id:2, type:"success", title:"Vaccination Drive Complete — Sami Village",  body:"3 volunteers administered 280 doses. 100% coverage achieved.",               time:"1 hr ago",   read:false },
      { id:3, type:"task",    title:"Eye Camp scheduled — Harij Village",         body:"April 18. Optometrist Priya Mehta confirmed.",                               time:"3 hrs ago",  read:true  },
      { id:4, type:"info",    title:"New Volunteer: Rajan Vora (CHW)",            body:"Community Health Worker added to Patan pool.",                               time:"Yesterday",  read:true  },
      { id:5, type:"report",  title:"Monthly Health Report — March 2026",         body:"8 camps completed. 1,420 patients served. 22 active volunteers.",            time:"Yesterday",  read:true  },
    ],
    uploads: [
      { id:1, file:"health_survey_patan_q1.csv",   village:"Patan",    issue:"General Health",  records:320, date:"Today 10:00 AM", status:"done"       },
      { id:2, file:"maternal_siddhpur_apr.pdf",    village:"Siddhpur", issue:"Maternal Health", records:48,  date:"Yesterday",      status:"done"       },
      { id:3, file:"eye_camp_harij_register.xlsx", village:"Harij",    issue:"Eye Care",        records:92,  date:"2 days ago",     status:"processing" },
    ],
    chartData: {
      categories: [
        { label:"Medical", value:45, color:"#EF4444" }, { label:"Maternal", value:20, color:"#EC4899" },
        { label:"Vaccine", value:18, color:"#16A34A" }, { label:"Eye Care", value:12, color:"#0891B2" },
        { label:"Mental",  value:5,  color:"#7C3AED" },
      ],
      regions: [{ label:"Patan",value:60 },{ label:"Mehsana",value:22 },{ label:"Banaskantha",value:18 }],
      trends:  [{ month:"Oct",value:12 },{ month:"Nov",value:15 },{ month:"Dec",value:18 },{ month:"Jan",value:16 },{ month:"Feb",value:20 },{ month:"Mar",value:22 }],
      resolution:[{ label:"Medical",value:82 },{ label:"Maternal",value:65 },{ label:"Vaccine",value:95 },{ label:"Eye Care",value:40 },{ label:"Mental",value:50 }],
    },
  },

  "flood@aid.org": {
    stats: { totalNeeds: 7, volunteers: 35, resolved: 4, urgent: 4 },
    needs: [
      { id:1, location:"Dhanera Town",    category:"Flood Rescue",    region:"Banaskantha", priority:"urgent", volunteers:20, assigned:8,  status:"active",   deadline:"2026-04-06" },
      { id:2, location:"Bhabhar Village", category:"Shelter Crisis",  region:"Banaskantha", priority:"urgent", volunteers:12, assigned:3,  status:"active",   deadline:"2026-04-07" },
      { id:3, location:"Palanpur City",   category:"Food & Water",    region:"Banaskantha", priority:"urgent", volunteers:10, assigned:5,  status:"active",   deadline:"2026-04-06" },
      { id:4, location:"Tharad",          category:"Medical Relief",  region:"Banaskantha", priority:"urgent", volunteers:6,  assigned:0,  status:"open",     deadline:"2026-04-08" },
      { id:5, location:"Kankrej",         category:"Clothing Drive",  region:"Banaskantha", priority:"medium", volunteers:4,  assigned:4,  status:"resolved", deadline:"2026-04-01" },
      { id:6, location:"Suigam",          category:"Road Clearance",  region:"Banaskantha", priority:"medium", volunteers:8,  assigned:2,  status:"active",   deadline:"2026-04-10" },
      { id:7, location:"Deesa",           category:"Sanitation",      region:"Banaskantha", priority:"low",    volunteers:3,  assigned:3,  status:"resolved", deadline:"2026-04-02" },
    ],
    volunteers: [
      { id:1, name:"Kiran Barot",   initials:"KB", skill:"Rescue Operations",    distance:0,  rating:5, tasks:31, points:1580, match:97, available:true,  color:"#EF4444", region:"Banaskantha", lat:24.5083, lng:72.0217 },
      { id:2, name:"Suresh Nayak",  initials:"SN", skill:"Logistics & Transport",distance:0,  rating:5, tasks:26, points:1300, match:91, available:true,  color:"#F59E0B", region:"Banaskantha", lat:24.1725, lng:72.4383 },
      { id:3, name:"Lata Chaudhary",initials:"LC", skill:"Medical & First Aid",  distance:0,  rating:4, tasks:18, points:890,  match:83, available:true,  color:"#EC4899", region:"Banaskantha", lat:24.2581, lng:72.1890 },
      { id:4, name:"Amish Solanki", initials:"AS", skill:"Civil Engineer",       distance:0,  rating:4, tasks:14, points:680,  match:75, available:true,  color:"#6366F1", region:"Banaskantha", lat:24.0333, lng:72.3333 },
      { id:5, name:"Dhruv Rana",    initials:"DR", skill:"Food Distribution",    distance:0,  rating:3, tasks:9,  points:410,  match:60, available:false, color:"#16A34A", region:"Banaskantha", lat:24.3961, lng:71.6256 },
      { id:6, name:"Foram Trivedi", initials:"FT", skill:"Social Worker",        distance:0, rating:4, tasks:7,  points:340,  match:55, available:true,  color:"#0891B2", region:"Banaskantha", lat:24.1333, lng:71.4833 },
    ],
    notifications: [
      { id:1, type:"urgent",  title:"ALERT: Dhanera flooding — Level 3",           body:"20 volunteers deployed. 8 boats operational. 340 residents evacuated so far.",  time:"Just now",   read:false },
      { id:2, type:"urgent",  title:"Shelter shortage — Bhabhar Village",          body:"1,200 displaced. Only 400 capacity at current relief camp. Urgent expansion.",  time:"10 min ago", read:false },
      { id:3, type:"task",    title:"Kiran Barot leading Dhanera rescue op",       body:"97% AI-match. 8 rescue workers confirmed under his leadership.",                time:"30 min ago", read:false },
      { id:4, type:"success", title:"Sanitation complete — Deesa",                 body:"3 volunteers sanitized 4 blocks. Health risk downgraded.",                      time:"2 hrs ago",  read:true  },
      { id:5, type:"success", title:"Clothing Drive complete — Kankrej",           body:"420 families received relief kits. Fully resolved.",                            time:"3 hrs ago",  read:true  },
      { id:6, type:"info",    title:"Govt. coordination call scheduled",           body:"April 6, 2pm — Banaskantha Collector's office. Join remotely.",                  time:"Yesterday",  read:true  },
    ],
    uploads: [
      { id:1, file:"flood_dhanera_assessment.pdf",  village:"Dhanera",  issue:"Flood Rescue",   records:180, date:"Today 7:30 AM", status:"done"       },
      { id:2, file:"shelter_bhabhar_census.csv",    village:"Bhabhar",  issue:"Shelter Crisis", records:312, date:"Today 8:00 AM", status:"processing" },
      { id:3, file:"medical_tharad_scan.jpg",       village:"Tharad",   issue:"Medical Relief", records:64,  date:"Yesterday",     status:"done"       },
      { id:4, file:"road_suigam_report.xlsx",       village:"Suigam",   issue:"Road Clearance", records:28,  date:"2 days ago",    status:"done"       },
    ],
    chartData: {
      categories: [
        { label:"Rescue",   value:35, color:"#EF4444" }, { label:"Shelter",  value:28, color:"#7C3AED" },
        { label:"Food",     value:20, color:"#F59E0B" }, { label:"Medical",  value:12, color:"#EC4899" },
        { label:"Sanit.",   value:5,  color:"#0891B2" },
      ],
      regions: [{ label:"Banaskantha",value:70 },{ label:"Patan",value:18 },{ label:"Sabarkantha",value:12 }],
      trends:  [{ month:"Oct",value:5 },{ month:"Nov",value:4 },{ month:"Dec",value:8 },{ month:"Jan",value:6 },{ month:"Feb",value:12 },{ month:"Mar",value:35 }],
      resolution:[{ label:"Rescue",value:45 },{ label:"Shelter",value:30 },{ label:"Food",value:60 },{ label:"Medical",value:25 },{ label:"Sanit.",value:80 }],
    },
  },

  "admin@ReliefLink.org": {
    stats: { totalNeeds: 142, volunteers: 318, resolved: 89, urgent: 17 },
    needs: [
      { id:1,  location:"Rajpur Village",  category:"Water Crisis",    region:"Mehsana",     priority:"urgent", volunteers:8,  assigned:3,  status:"active",   deadline:"2026-04-08" },
      { id:2,  location:"Dhanera Town",    category:"Flood Rescue",    region:"Banaskantha", priority:"urgent", volunteers:20, assigned:8,  status:"active",   deadline:"2026-04-06" },
      { id:3,  location:"Siddhpur Town",   category:"Maternal Health", region:"Patan",       priority:"urgent", volunteers:4,  assigned:1,  status:"active",   deadline:"2026-04-07" },
      { id:4,  location:"Bhabhar Village", category:"Shelter Crisis",  region:"Banaskantha", priority:"urgent", volunteers:12, assigned:3,  status:"active",   deadline:"2026-04-07" },
      { id:5,  location:"Harij Village",   category:"Medical Camp",    region:"Patan",       priority:"medium", volunteers:6,  assigned:4,  status:"active",   deadline:"2026-04-10" },
      { id:6,  location:"Kankrej",         category:"Food Shortage",   region:"Banaskantha", priority:"medium", volunteers:6,  assigned:4,  status:"active",   deadline:"2026-04-09" },
      { id:7,  location:"Unjha",           category:"Drought Aid",     region:"Mehsana",     priority:"medium", volunteers:5,  assigned:3,  status:"active",   deadline:"2026-04-10" },
      { id:8,  location:"Palanpur City",   category:"Food & Water",    region:"Banaskantha", priority:"urgent", volunteers:10, assigned:5,  status:"active",   deadline:"2026-04-06" },
      { id:9,  location:"Tharad",          category:"Medical Relief",  region:"Banaskantha", priority:"urgent", volunteers:6,  assigned:0,  status:"open",     deadline:"2026-04-08" },
      { id:10, location:"Chanasma Town",   category:"School Supplies", region:"Patan",       priority:"low",    volunteers:2,  assigned:2,  status:"resolved", deadline:"2026-03-28" },
      { id:11, location:"Sami Village",    category:"Vaccination",     region:"Patan",       priority:"medium", volunteers:3,  assigned:3,  status:"resolved", deadline:"2026-04-01" },
      { id:12, location:"Vijapur",         category:"Sanitation",      region:"Mehsana",     priority:"low",    volunteers:3,  assigned:0,  status:"open",     deadline:"2026-04-15" },
    ],
    volunteers: [
      { id:1, name:"Arjun Kumar",   initials:"AK", skill:"Water Logistics",       distance:0,  rating:5, tasks:24, points:1240, match:96, available:true,  color:"#6366F1", region:"Mehsana",     lat:23.5880, lng:72.3693 },
      { id:2, name:"Priya Mehta",   initials:"PM", skill:"Medical & First Aid",   distance:0,  rating:4, tasks:19, points:980,  match:84, available:true,  color:"#EC4899", region:"Patan",       lat:23.8493, lng:72.1266 },
      { id:3, name:"Sonal Raval",   initials:"SR", skill:"Civil Engineer",        distance:0,  rating:5, tasks:17, points:850,  match:79, available:true,  color:"#F59E0B", region:"Mehsana",     lat:23.6997, lng:72.5469 },
      { id:4, name:"Kiran Barot",   initials:"KB", skill:"Rescue Operations",     distance:0,  rating:5, tasks:31, points:1580, match:97, available:true,  color:"#EF4444", region:"Banaskantha", lat:24.5083, lng:72.0217 },
      { id:5, name:"Rohit Desai",   initials:"RD", skill:"Logistics & Transport", distance:0,  rating:4, tasks:15, points:720,  match:67, available:false, color:"#16A34A", region:"Banaskantha", lat:24.1725, lng:72.4383 },
      { id:6, name:"Neha Kaur",     initials:"NK", skill:"Social Worker",         distance:0, rating:4, tasks:12, points:590,  match:61, available:true,  color:"#0891B2", region:"Patan",       lat:23.9161, lng:72.3802 },
      { id:7, name:"Vijay Patel",   initials:"VP", skill:"Water Engineer",        distance:0, rating:5, tasks:11, points:530,  match:58, available:true,  color:"#7C3AED", region:"Mehsana",     lat:23.8002, lng:72.3925 },
      { id:8, name:"Anita Shah",    initials:"AS", skill:"Teaching & Education",  distance:0,  rating:4, tasks:9,  points:440,  match:52, available:true,  color:"#DB2777", region:"Gandhinagar", lat:23.2156, lng:72.6369 },
    ],
    notifications: [
      { id:1, type:"urgent",  title:"[ADMIN] Dhanera Flood — Level 3 Active",       body:"Banaskantha: 20 volunteers deployed, 340 evacuated. Flood Aid Gujarat leading.",  time:"Just now",   read:false },
      { id:2, type:"urgent",  title:"[ADMIN] Water Crisis — Rajpur Village",         body:"ReliefLink Foundation: 8 volunteers needed. 4,200 residents affected.",             time:"10 min ago", read:false },
      { id:3, type:"info",    title:"New NGO registered: Farmers Relief Trust",      body:"Joined platform from Sabarkantha. 12 volunteers onboarded.",                      time:"1 hr ago",   read:false },
      { id:4, type:"report",  title:"Platform Weekly Report — March 2026",           body:"89 needs resolved across 4 NGOs. 2,840 volunteer hours. 18% efficiency gain.",    time:"2 hrs ago",  read:true  },
      { id:5, type:"success", title:"Vaccination Drive complete — Sami (Care Soc.)", body:"Gujarat Care Society: 280 doses administered. 100% village coverage.",            time:"3 hrs ago",  read:true  },
      { id:6, type:"task",    title:"Cross-NGO coordination call tomorrow",          body:"April 6, 10am. ReliefLink Foundation + Flood Aid Gujarat + Care Society.",           time:"Yesterday",  read:true  },
    ],
    uploads: [
      { id:1, file:"platform_all_ngos_march.csv",   village:"All Regions",  issue:"Platform Overview", records:1420, date:"Today 6:00 AM", status:"done"       },
      { id:2, file:"flood_dhanera_assessment.pdf",  village:"Dhanera",      issue:"Flood Rescue",      records:180,  date:"Today 7:30 AM", status:"done"       },
      { id:3, file:"survey_rajpur_march.csv",       village:"Rajpur",       issue:"Water Supply",      records:142,  date:"Today 9:12 AM", status:"done"       },
      { id:4, file:"health_survey_patan_q1.csv",    village:"Patan",        issue:"General Health",    records:320,  date:"Yesterday",     status:"done"       },
      { id:5, file:"shelter_bhabhar_census.csv",    village:"Bhabhar",      issue:"Shelter Crisis",    records:312,  date:"Yesterday",     status:"processing" },
    ],
    chartData: {
      categories: [
        { label:"Water",   value:42, color:"#2563EB" }, { label:"Medical",  value:28, color:"#EF4444" },
        { label:"Food",    value:21, color:"#F59E0B" }, { label:"Shelter",  value:19, color:"#7C3AED" },
        { label:"Edu.",    value:18, color:"#16A34A" }, { label:"Sanit.",   value:14, color:"#0891B2" },
      ],
      regions: [{ label:"Mehsana",value:42 },{ label:"Patan",value:31 },{ label:"Banaskantha",value:52 },{ label:"Sabarkantha",value:17 }],
      trends:  [{ month:"Oct",value:68 },{ month:"Nov",value:52 },{ month:"Dec",value:84 },{ month:"Jan",value:61 },{ month:"Feb",value:93 },{ month:"Mar",value:142 }],
      resolution:[{ label:"Water",value:78 },{ label:"Medical",value:62 },{ label:"Food",value:48 },{ label:"Edu.",value:91 },{ label:"Sanit.",value:31 }],
    },
  },
};

const BLANK_DB = () => ({
  stats: { totalNeeds: 0, volunteers: 0, resolved: 0, urgent: 0 },
  needs: [], volunteers: [], notifications: [], uploads: [],
  chartData: {
    categories: [], regions: [],
    trends:  [{ month:"Oct",value:0 },{ month:"Nov",value:0 },{ month:"Dec",value:0 },{ month:"Jan",value:0 },{ month:"Feb",value:0 },{ month:"Mar",value:0 }],
    resolution: [],
  },
});

/* ─── FIREBASE FIRESTORE API INTEGRATION ─── */
let _currentEmail = null;
const _cache = new Map();

function computeDynamicChartData(needs, existingChartData) {
  const cats = {}, regs = {}, res = {};
  needs.forEach(n => {
    cats[n.category] = (cats[n.category] || 0) + 1;
    regs[n.region] = (regs[n.region] || 0) + 1;
    if (n.status === "resolved") res[n.category] = (res[n.category] || 0) + 1;
  });
  const colors = ["#2563EB", "#EF4444", "#F59E0B", "#7C3AED", "#16A34A", "#0891B2", "#EC4899"];
  const categories = Object.entries(cats).map(([label, value], i) => ({ label: label.substring(0, 10), value, color: colors[i % colors.length] })).sort((a,b)=>b.value-a.value);
  const regions = Object.entries(regs).map(([label, value]) => ({ label: label.substring(0, 10), value })).sort((a,b)=>b.value-a.value);
  const resolution = Object.entries(cats).map(([label, total]) => {
    const solved = res[label] || 0;
    return { label: label.substring(0, 10), value: total > 0 ? Math.round((solved / total) * 100) : 0 };
  }).filter(c => c.value > 0).sort((a,b)=>b.value-a.value);
  return {
    ...existingChartData,
    categories: categories.length ? categories : existingChartData?.categories || [],
    regions: regions.length ? regions : existingChartData?.regions || [],
    resolution: resolution.length ? resolution : existingChartData?.resolution || []
  };
}

const getNgoRef = () => doc(db, "ngos", _currentEmail);

const fetchOrInitData = async () => {
  if (!_currentEmail) return BLANK_DB();
  if (_cache.has(_currentEmail)) return _cache.get(_currentEmail);
  const ref = getNgoRef();
  const snap = await getDoc(ref);
  let data;
  if (snap.exists()) {
    data = snap.data();
  } else {
    data = SEED[_currentEmail] || BLANK_DB();
    if(SEED[_currentEmail]) await setDoc(ref, data);
  }
  
  if (data.needs) {
    data.needs = data.needs.map((n) => {
      if (n.lat != null && n.lng != null) return n;
      const { lat, lng } = resolveNeedCoordinates(n);
      return { ...n, lat, lng };
    });
  }

  // Inject exact real-world volunteer coordinates (overrides any stale Firestore cache)
  if (data.volunteers) {
    const VOL_LOCATIONS = {
      "Arjun Kumar":   { lat: 23.5880, lng: 72.3693 },  // Mehsana town
      "Sonal Raval":   { lat: 23.6997, lng: 72.5469 },  // Visnagar, Mehsana
      "Rohit Desai":   { lat: 24.1725, lng: 72.4383 },  // Palanpur, Banaskantha
      "Vijay Patel":   { lat: 23.8002, lng: 72.3925 },  // Unjha, Mehsana
      "Dev Pandya":    { lat: 23.7861, lng: 72.6361 },  // Vadnagar, Mehsana
      "Priya Mehta":   { lat: 23.8493, lng: 72.1266 },  // Patan city
      "Neha Kaur":     { lat: 23.9161, lng: 72.3802 },  // Siddhpur, Patan
      "Meena Joshi":   { lat: 23.7000, lng: 71.7833 },  // Sami, Patan
      "Rajan Vora":    { lat: 23.8333, lng: 71.6000 },  // Radhanpur, Patan
      "Kiran Barot":   { lat: 24.5083, lng: 72.0217 },  // Dhanera, Banaskantha
      "Suresh Nayak":  { lat: 24.1725, lng: 72.4383 },  // Palanpur, Banaskantha
      "Lata Chaudhary":{ lat: 24.2581, lng: 72.1890 },  // Deesa, Banaskantha
      "Amish Solanki": { lat: 24.0333, lng: 72.3333 },  // Bhabhar, Banaskantha
      "Dhruv Rana":    { lat: 24.3961, lng: 71.6256 },  // Tharad, Banaskantha
      "Foram Trivedi": { lat: 24.1333, lng: 71.4833 },  // Suigam, Banaskantha
      "Anita Shah":    { lat: 23.2156, lng: 72.6369 },  // Gandhinagar
    };
    data.volunteers = data.volunteers.map(v => {
      const loc = VOL_LOCATIONS[v.name];
      if (loc) return { ...v, lat: loc.lat, lng: loc.lng, distance: 0 };
      return v;
    });
  }
  
  data.chartData = computeDynamicChartData(data.needs || [], data.chartData);
  _cache.set(_currentEmail, data);
  return data;
};

export const api = {
  setAccount: (email) => { _currentEmail = email; },
  cached: () => _cache.get(_currentEmail) || null,

  getStats:         async () => { const d = await fetchOrInitData(); return d.stats || BLANK_DB().stats; },
  getNeeds: async () => {
    if (_currentEmail) {
      try {
        return await getAllIncidents(_currentEmail);
      } catch (error) {
        console.warn('Falling back to cached needs after incident fetch failure', error);
      }
    }
    const d = await fetchOrInitData();
    return d.needs || [];
  },
  getVolunteers:    async () => { const d = await fetchOrInitData(); return d.volunteers || []; },
  getNotifications: async () => { const d = await fetchOrInitData(); return d.notifications || []; },
  getUploads:       async () => { const d = await fetchOrInitData(); return d.uploads || []; },
  getChartData:     async () => { const d = await fetchOrInitData(); return d.chartData || BLANK_DB().chartData; },

  assignVolunteer: async (volId, needId) => {
    const data = await fetchOrInitData();
    const needs = data.needs.map(n => n.id === needId ? { ...n, assigned: Math.min(n.assigned + 1, n.volunteers) } : n);
    const volunteers = data.volunteers.map(v => v.id === volId ? { ...v, available: false, tasks: v.tasks + 1 } : v);
    const chartData = computeDynamicChartData(needs, data.chartData);
    _cache.set(_currentEmail, { ...data, needs, volunteers, chartData });
    await updateDoc(getNgoRef(), { needs, volunteers });
    return { success: true, message: `Volunteer #${volId} assigned to need #${needId}` };
  },

  markRead: async (id) => {
    const data = await fetchOrInitData();
    const notifications = data.notifications.map(n => n.id === id ? { ...n, read: true } : n);
    _cache.set(_currentEmail, { ...data, notifications });
    await updateDoc(getNgoRef(), { notifications });
    return true;
  },

  markAllRead: async () => {
    const data = await fetchOrInitData();
    const notifications = data.notifications.map(n => ({ ...n, read: true }));
    _cache.set(_currentEmail, { ...data, notifications });
    await updateDoc(getNgoRef(), { notifications });
    return true;
  },

  resolveNeed: async (id) => {
    if (_currentEmail) {
      await updateIncidentStatus(_currentEmail, id, 'resolved');
      return true;
    }
    const data = await fetchOrInitData();
    const needs = data.needs.map(n => n.id === id ? { ...n, status: "resolved" } : n);
    const stats = { ...data.stats, resolved: needs.filter(n => n.status === "resolved").length, urgent: needs.filter(n => n.priority === "urgent" && n.status !== "resolved").length, totalNeeds: needs.filter(n => n.status !== "resolved").length };
    const chartData = computeDynamicChartData(needs, data.chartData);
    _cache.set(_currentEmail, { ...data, needs, stats, chartData });
    await updateDoc(getNgoRef(), { needs, stats });
    return true;
  },

  deleteNeed: async (id) => {
    if (_currentEmail) {
      await deleteIncidentDoc(_currentEmail, id);
      return true;
    }
    const data = await fetchOrInitData();
    const needs = data.needs.filter((n) => n.id !== id);
    const stats = {
      ...data.stats,
      resolved: needs.filter((n) => n.status === "resolved").length,
      urgent: needs.filter((n) => n.priority === "urgent" && n.status !== "resolved").length,
      totalNeeds: needs.filter((n) => n.status !== "resolved").length,
    };
    const chartData = computeDynamicChartData(needs, data.chartData);
    _cache.set(_currentEmail, { ...data, needs, stats, chartData });
    await updateDoc(getNgoRef(), { needs, stats, chartData });
    return true;
  },

  addNeed: async (newNeed) => {
    // Data-layer validation prevents malformed or unsafe task content from being persisted.
    const validation = validateNeed(newNeed, { ngoEmail: _currentEmail });
    if (!validation.isValid) {
      throw new Error(Object.values(validation.errors)[0] || "Invalid need data.");
    }
    const safeNeed = validation.sanitizedData;
    if (_currentEmail) {
      const docId = await createIncidentDoc(_currentEmail, safeNeed);
      return { ...safeNeed, id: docId };
    }
    const data = await fetchOrInitData();
    const needs = [safeNeed, ...data.needs];
    const stats = { ...data.stats, totalNeeds: needs.filter(n => n.status !== "resolved").length, urgent: needs.filter(n => n.priority === "urgent" && n.status !== "resolved").length };
    const chartData = computeDynamicChartData(needs, data.chartData);
    const notifications = [{ id: data.notifications.length + 1, type: "task", title: `Task Added: ${safeNeed.category}`, body: `New ${safeNeed.priority} task queued for ${safeNeed.region}.`, time: "Just now", read: false }, ...data.notifications];
    _cache.set(_currentEmail, { ...data, needs, stats, chartData, notifications });
    await updateDoc(getNgoRef(), { needs, stats, notifications });
    return safeNeed;
  },

  addVolunteer: async (newVol) => {
    // Re-validate at the data layer so invalid payloads cannot bypass UI checks.
    const validation = validateVolunteer(newVol, { ngoEmail: _currentEmail });
    if (!validation.isValid) {
      throw new Error(Object.values(validation.errors)[0] || "Invalid volunteer data.");
    }
    const data = await fetchOrInitData();
    const safeVolunteer = validation.sanitizedData;
    const volunteers = [...data.volunteers, safeVolunteer];
    const stats = { ...data.stats, volunteers: volunteers.length };
    const notifications = [{ id: data.notifications.length + 1, type: "info", title: `New Volunteer: ${safeVolunteer.name} (${safeVolunteer.skill})`, body: `Joined ${safeVolunteer.region} volunteer pool. Skills: ${safeVolunteer.skill}.`, time: "Just now", read: false }, ...data.notifications];
    _cache.set(_currentEmail, { ...data, volunteers, stats, notifications });
    await updateDoc(getNgoRef(), { volunteers, stats, notifications });
    return { volunteers, stats };
  },

  saveUploadNeeds: async (newNeeds, newUpload, newNotification) => {
    const data = await fetchOrInitData();
    const needs = [...data.needs, ...newNeeds];
    const stats = { ...data.stats, totalNeeds: needs.filter(n => n.status !== "resolved").length, urgent: needs.filter(n => n.priority === "urgent" && n.status !== "resolved").length };
    const chartData = computeDynamicChartData(needs, data.chartData);
    const uploads = [newUpload, ...data.uploads];
    const notifications = [newNotification, ...data.notifications];
    _cache.set(_currentEmail, { ...data, needs, stats, uploads, notifications, chartData });
    await updateDoc(getNgoRef(), { needs, stats, uploads, notifications });
    return uploads;
  },

  /**
   * Emergency Mode: create an urgent need at the highest-priority site coordinates,
   * pick the nearest volunteer (prefer available), auto-assign, and prepend notifications.
   */
  activateEmergencyMode: async () => {
    const data = await fetchOrInitData();
    const needs = data.needs || [];
    const volunteers = data.volunteers || [];

    const ref =
      needs.find((n) => n.priority === "urgent" && (n.status === "open" || n.status === "active")) ||
      needs.find((n) => n.status === "open") ||
      needs[0];

    const lat = ref?.lat ?? 23.588;
    const lng = ref?.lng ?? 72.369;
    const region = ref?.region ?? "Mehsana";
    const siteName = ref?.location ?? "Command area";

    const newId = Date.now();
    const newNeed = {
      id: newId,
      location: `Emergency — ${siteName}`,
      category: "Emergency Response",
      region,
      priority: "urgent",
      volunteers: 8,
      assigned: 1,
      status: "active",
      deadline: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      lat,
      lng,
    };

    const withCoords = volunteers.filter((v) => v.lat != null && v.lng != null);
    if (!withCoords.length) {
      return { success: false, error: "No volunteers with coordinates on file." };
    }

    const preferAvailable = withCoords.filter((v) => v.available);
    const pool = preferAvailable.length ? preferAvailable : withCoords;

    let nearest = pool[0];
    let distanceKm = haversineKm(lat, lng, nearest.lat, nearest.lng);
    for (let i = 1; i < pool.length; i++) {
      const v = pool[i];
      const d = haversineKm(lat, lng, v.lat, v.lng);
      if (d < distanceKm) {
        distanceKm = d;
        nearest = v;
      }
    }

    const updatedVolunteers = volunteers.map((v) =>
      v.id === nearest.id ? { ...v, available: false, tasks: (v.tasks || 0) + 1 } : v
    );

    const allNeeds = [newNeed, ...needs];
    const stats = {
      ...data.stats,
      totalNeeds: allNeeds.filter((n) => n.status !== "resolved").length,
      urgent: allNeeds.filter((n) => n.priority === "urgent" && n.status !== "resolved").length,
    };
    const chartData = computeDynamicChartData(allNeeds, data.chartData);
    const nextNotifId =
      (data.notifications || []).reduce((m, n) => Math.max(m, Number(n.id) || 0), 0) + 1;
    const distLabel = Number.isFinite(distanceKm) ? `${distanceKm.toFixed(1)} km` : "nearby";
    const assignNotif = {
      id: nextNotifId,
      type: "urgent",
      title: `Emergency task assigned: ${nearest.name}`,
      body: `Urgent need created at ${siteName}. ${nearest.name} is closest (${distLabel}) and has been notified and auto-assigned.`,
      time: "Just now",
      read: false,
    };
    const notifications = [assignNotif, ...(data.notifications || [])];

    _cache.set(_currentEmail, {
      ...data,
      needs: allNeeds,
      volunteers: updatedVolunteers,
      notifications,
      stats,
      chartData,
    });
    await updateDoc(getNgoRef(), { needs: allNeeds, volunteers: updatedVolunteers, notifications, stats, chartData });

    return {
      success: true,
      need: newNeed,
      volunteer: nearest,
      distanceKm: Number.isFinite(distanceKm) ? distanceKm : null,
    };
  },

  simulateIncident: async () => {
    const data = await fetchOrInitData();
    const incidentTypes = [
      { cat: "Flood Alert", loc: "Santhal", reg: "Mehsana", priority: "urgent", vol: 12 },
      { cat: "Water Shortage", loc: "Radhanpur", reg: "Patan", priority: "urgent", vol: 8 },
      { cat: "Medical Emergency", loc: "Deesa", reg: "Banaskantha", priority: "urgent", vol: 6 },
    ];
    const item = incidentTypes[Math.floor(Math.random() * incidentTypes.length)];
    const newNeed = {
      id: Date.now(),
      location: item.loc,
      category: item.cat,
      region: item.reg,
      priority: item.priority,
      volunteers: item.vol,
      assigned: 0,
      status: "open",
      deadline: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
    };
    
    const needs = [newNeed, ...data.needs];
    const stats = { 
      ...data.stats, 
      totalNeeds: needs.filter(n => n.status !== "resolved").length, 
      urgent: needs.filter(n => n.priority === "urgent" && n.status !== "resolved").length 
    };
    
    const newNotification = {
      id: Date.now() + 1,
      type: "urgent",
      title: `CRITICAL: ${item.cat} in ${item.loc}`,
      body: `Immediate coordination required for ${item.loc} area. ${item.vol} volunteers needed.`,
      time: "Just now",
      read: false
    };
    
    const notifications = [newNotification, ...data.notifications];
    const chartData = computeDynamicChartData(needs, data.chartData);
    
    _cache.set(_currentEmail, { ...data, needs, stats, notifications, chartData });
    await updateDoc(getNgoRef(), { needs, stats, notifications });
    return { newNeed, newNotification };
  }
};

/* ─── AUTH: accounts ─── */
export const NGO_TYPES = ["Relief NGO","Health NGO","Disaster Relief","Education NGO","Water & Sanitation","Food Security","Community Development","Super Admin"];

let _accounts = [
  { email:"ngo@ReliefLink.org",   password:"ngo123",   name:"ReliefLink Foundation",   type:"Relief NGO"      },
  { email:"care@gujarat.org",   password:"care123",  name:"Gujarat Care Society",  type:"Health NGO"      },
  { email:"flood@aid.org",      password:"flood123", name:"Flood Aid Gujarat",     type:"Disaster Relief" },
  { email:"admin@ReliefLink.org", password:"admin123", name:"ReliefLink Admin",        type:"Super Admin"     },
];

try {
  const saved = localStorage.getItem("ReliefLink_accounts");
  if (saved) {
    const parsed = JSON.parse(saved);
    const defaultEmails = new Set(_accounts.map(a => a.email));
    parsed.forEach(a => { if (!defaultEmails.has(a.email)) _accounts.push(a); });
  }
} catch (e) { console.warn("Failed to load accounts", e); }

export const DEMO_ACCOUNTS = _accounts.slice();

export function getAccounts() { return _accounts; }

export function addAccount(account) {
  _accounts = [..._accounts, account];
  localStorage.setItem("ReliefLink_accounts", JSON.stringify(_accounts));
}

export function findAccount(email, password) {
  return _accounts.find(a => a.email === email.trim().toLowerCase() && a.password === password);
}

export function emailExists(email) {
  return !!_accounts.find(a => a.email === email.trim().toLowerCase());
}
