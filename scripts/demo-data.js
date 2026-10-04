// Plain data with no database imports, so the browser demo can use it too.
import { STATUS_FLOW } from '../src/domain.js';

export const DEMO_TRACKING_CODE = 'HH-7K3P9Q';
export const DEMO_ADMIN_PASSWORD = 'helpinghands-demo';

const HOUR = 60 * 60 * 1000;
// Hours between consecutive steps: received -> scheduled -> collected -> delivered.
const STEP_GAPS = [3, 22, 18];

// Fictional donors with valid-looking numbers, so the dashboard has something to show.
const DEMO_DONATIONS = [
  ['HH-7K3P9Q', 'Priya Sharma', '+919845012345', 'clothes', '14, 2nd Cross, Indiranagar, Bengaluru 560038', 'Two bags of winter wear', 'collected', 52],
  ['HH-4MXH2R', 'Arjun Nair', '+919880123456', 'stationery', '221, 5th Main, HSR Layout, Bengaluru 560102', 'Notebooks and geometry boxes for a school drive', 'delivered', 210],
  ['HH-9BTE6W', 'Fatima Khan', '+917019234567', 'food', '7, Hosur Road, Koramangala, Bengaluru 560095', '20 kg rice and 5 kg dal', 'delivered', 160],
  ['HH-Q8N3JD', 'Rahul Verma', '+918147345678', 'gadgets', '33, 1st Block, Jayanagar, Bengaluru 560011', 'Old laptop, working, with charger', 'scheduled', 20],
  ['HH-H5ZK7C', 'Ananya Rao', '+919741456789', 'footwear', '9, 4th Cross, Malleshwaram, Bengaluru 560003', 'Six pairs of school shoes', 'received', 2],
  ['HH-2RVM8F', 'Mohammed Irfan', '+916361567890', 'funds', '18, Frazer Town Main Road, Bengaluru 560005', 'Monthly contribution', 'collected', 75],
  ['HH-W6PA4T', 'Sneha Reddy', '+919902678901', 'clothes', '101, Whitefield Main Road, Bengaluru 560066', 'Kids clothes, ages 4 to 8', 'scheduled', 9],
  ['HH-K3YG9N', 'Vikram Iyer', '+918088789012', 'food', '56, BTM 2nd Stage, Bengaluru 560076', 'Packed groceries for 4 families', 'received', 5],
  ['HH-D7SX2E', 'Meera Pillai', '+917676890123', 'stationery', '12, Basavanagudi, Bengaluru 560004', '', 'delivered', 120],
  ['HH-M4CQ8H', 'Karthik Gowda', '+919611901234', 'gadgets', '44, Rajajinagar 3rd Block, Bengaluru 560010', 'Two Android phones', 'received', 1],
  ['HH-T9FB3Z', 'Aisha Begum', '+918971012345', 'footwear', '3, RT Nagar Main Road, Bengaluru 560032', '', 'scheduled', 30],
  ['HH-5NJW7K', 'Rohan Das', '+919036123456', 'clothes', '77, Electronic City Phase 1, Bengaluru 560100', 'Formal shirts and trousers', 'received', 12],
];

export function demoDonations(now = Date.now()) {
  return DEMO_DONATIONS.map(([code, name, phone, category, address, notes, status, hoursAgo]) => {
    const createdAt = new Date(now - hoursAgo * HOUR);
    const steps = STATUS_FLOW.slice(0, STATUS_FLOW.indexOf(status) + 1);

    let at = createdAt.getTime();
    const timeline = steps.map((step, i) => {
      if (i > 0) at += STEP_GAPS[i - 1] * HOUR;
      return { status: step, at: new Date(at) };
    });

    return { code, name, phone, category, address, notes, status, timeline, createdAt, updatedAt: timeline.at(-1).at };
  });
}
