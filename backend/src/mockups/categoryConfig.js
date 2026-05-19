/**
 * Category Config — drives all visual and copy variation in template.html.
 */

const CATEGORY_CONFIG = {
  restaurant: {
    accent: '#f97316', accentLight: '#fff9ee', ringColor: '#f0c060',
    circleColor: '#fdba74', innerColor: '#f97316',
    navLinks: ['Menu', 'About Us', 'Gallery', 'Contact'],
    cta1: 'Reserve a Table', cta2: 'View Menu',
    titleLine2: 'Flavours Worth Savouring', titleAccent: 'Worth Savouring',
    hours: 'Open 11am – 11pm', sectionTitle: 'Our Popular', sectionAccent: 'Dishes',
    cards: [
      { name: 'Butter Chicken', price: '&#8377;320',  color: '#fb923c', desc: 'Creamy tomato gravy, tender chicken' },
      { name: 'Paneer Tikka',   price: '&#8377;240',  color: '#fbbf24', desc: 'Smoky grilled cottage cheese' },
      { name: 'Masala Dosa',    price: '&#8377;160',  color: '#fdba74', desc: 'Crispy dosa, spiced potato filling' },
      { name: 'Biryani',        price: '&#8377;380',  color: '#f97316', desc: 'Fragrant basmati, saffron, spices' },
    ],
  },
  salon: {
    accent: '#d4537e', accentLight: '#fdf0f5', ringColor: '#f4c0d1',
    circleColor: '#f9a8c9', innerColor: '#d4537e',
    navLinks: ['Services', 'Gallery', 'Offers', 'Book Now'],
    cta1: 'Book Appointment', cta2: 'Explore Services',
    titleLine2: 'Beauty, Redefined', titleAccent: 'Redefined',
    hours: 'Open 9am – 8pm', sectionTitle: 'Popular', sectionAccent: 'Services',
    cards: [
      { name: 'Haircut & Style', price: '&#8377;799',  color: '#f9a8c9', desc: 'Expert cut, blow dry & styling' },
      { name: 'Hair Colour',     price: '&#8377;2499', color: '#f472b6', desc: 'Global colour, highlights & balayage' },
      { name: 'Facial',          price: '&#8377;1299', color: '#fda4af', desc: 'Deep cleanse, glow facial treatment' },
      { name: 'Manicure',        price: '&#8377;599',  color: '#d4537e', desc: 'Shape, buff, polish & hand care' },
    ],
  },
  clinic: {
    accent: '#185FA5', accentLight: '#f0f6ff', ringColor: '#85b7eb',
    circleColor: '#93c5fd', innerColor: '#185FA5',
    navLinks: ['Services', 'Doctors', 'Reports', 'Contact'],
    cta1: 'Book Consultation', cta2: 'View Services',
    titleLine2: 'Healthcare You Can Trust', titleAccent: 'Trust',
    hours: 'Open 8am – 8pm', sectionTitle: 'Our', sectionAccent: 'Services',
    cards: [
      { name: 'General OPD',   price: '&#8377;300', color: '#93c5fd', desc: 'Expert general physician consult' },
      { name: 'Dental Care',   price: '&#8377;500', color: '#60a5fa', desc: 'Cleaning, scaling & dental care' },
      { name: 'Diagnostics',   price: '&#8377;799', color: '#3b82f6', desc: 'Blood tests, X-ray & imaging' },
      { name: 'Physiotherapy', price: '&#8377;600', color: '#185FA5', desc: 'Recovery & pain management' },
    ],
  },
  gym: {
    accent: '#27500A', accentLight: '#f2f9ec', ringColor: '#97c459',
    circleColor: '#86efac', innerColor: '#27500A',
    navLinks: ['Programs', 'Trainers', 'Schedule', 'Join Now'],
    cta1: 'Start Free Trial', cta2: 'View Programs',
    titleLine2: 'Transform Your Body', titleAccent: 'Transform',
    hours: 'Open 5am – 10pm', sectionTitle: 'Our', sectionAccent: 'Programs',
    cards: [
      { name: 'Weight Training',   price: '&#8377;1499/mo', color: '#86efac', desc: 'Full equipment access, all levels' },
      { name: 'Cardio Zone',       price: '&#8377;999/mo',  color: '#4ade80', desc: 'Treadmills, cycles & rowing' },
      { name: 'Yoga',              price: '&#8377;1199/mo', color: '#97c459', desc: 'Morning & evening yoga sessions' },
      { name: 'Personal Training', price: '&#8377;3999/mo', color: '#27500A', desc: 'Dedicated 1-on-1 fitness coach' },
    ],
  },
  retail: {
    accent: '#534AB7', accentLight: '#f5f4ff', ringColor: '#afa9ec',
    circleColor: '#c4b5fd', innerColor: '#534AB7',
    navLinks: ['Collections', 'Offers', 'New Arrivals', 'Contact'],
    cta1: 'Shop Now', cta2: 'Browse Catalogue',
    titleLine2: 'Style Meets Value', titleAccent: 'Style',
    hours: 'Open 10am – 9pm', sectionTitle: 'Featured', sectionAccent: 'Products',
    cards: [
      { name: 'Ethnic Wear',  price: '&#8377;1299', color: '#c4b5fd', desc: 'Kurtis, sarees & festive wear' },
      { name: 'Accessories',  price: '&#8377;499',  color: '#a78bfa', desc: 'Bags, belts, jewellery & more' },
      { name: 'Home Decor',   price: '&#8377;899',  color: '#afa9ec', desc: 'Candles, frames & gifting sets' },
      { name: 'Electronics',  price: '&#8377;2499', color: '#534AB7', desc: 'Earphones, chargers & gadgets' },
    ],
  },
  spa: {
    accent: '#0F6E56', accentLight: '#f0faf6', ringColor: '#5dcaa5',
    circleColor: '#6ee7b7', innerColor: '#0F6E56',
    navLinks: ['Treatments', 'Packages', 'Gift Cards', 'Book'],
    cta1: 'Book a Session', cta2: 'Explore Treatments',
    titleLine2: 'Relax. Restore. Renew.', titleAccent: 'Renew.',
    hours: 'Open 9am – 9pm', sectionTitle: 'Our Signature', sectionAccent: 'Treatments',
    cards: [
      { name: 'Deep Tissue',  price: '&#8377;1999', color: '#6ee7b7', desc: 'Intense muscle relief & recovery' },
      { name: 'Aromatherapy', price: '&#8377;1499', color: '#34d399', desc: 'Essential oils, stress melting away' },
      { name: 'Hot Stone',    price: '&#8377;2499', color: '#5dcaa5', desc: 'Heated basalt stones, deep warmth' },
      { name: 'Face Ritual',  price: '&#8377;1299', color: '#0F6E56', desc: 'Cleanse, tone & radiance boost' },
    ],
  },
  generic: {
    accent: '#6366F1', accentLight: '#EEF2FF', ringColor: '#C7D2FE',
    circleColor: '#A5B4FC', innerColor: '#6366F1',
    navLinks: ['Home', 'Services', 'About', 'Contact'],
    cta1: 'Get in Touch', cta2: 'Learn More',
    titleLine2: 'Excellence You Can Trust', titleAccent: 'Excellence',
    hours: 'Open Mon–Sat, 9am – 6pm', sectionTitle: 'What We', sectionAccent: 'Offer',
    cards: [
      { name: 'Our Services',    price: '', color: '#A5B4FC', desc: 'Tailored solutions for every need' },
      { name: 'Premium Quality', price: '', color: '#818CF8', desc: 'Best-in-class products & service' },
      { name: 'Expert Team',     price: '', color: '#6366F1', desc: 'Skilled professionals at your side' },
      { name: 'Contact Us',      price: '', color: '#4F46E5', desc: 'Reach us anytime, we are ready' },
    ],
  },
};

module.exports = CATEGORY_CONFIG;
