/**
 * Procureline Local Database Layer
 * Uses IndexedDB for persistent local storage
 */

const DB_NAME = 'ProcurelineDB';
const DB_VERSION = 1;

let db = null;

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

function initDatabase() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database opened successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            console.log('Creating database schema...');

            // Tenant store
            if (!database.objectStoreNames.contains('tenants')) {
                const tenantStore = database.createObjectStore('tenants', { keyPath: 'id' });
                tenantStore.createIndex('code', 'code', { unique: true });
            }

            // Users store
            if (!database.objectStoreNames.contains('users')) {
                const userStore = database.createObjectStore('users', { keyPath: 'id' });
                userStore.createIndex('email', 'email', { unique: true });
                userStore.createIndex('tenantId', 'tenantId', { unique: false });
            }

            // Departments store
            if (!database.objectStoreNames.contains('departments')) {
                const deptStore = database.createObjectStore('departments', { keyPath: 'id' });
                deptStore.createIndex('tenantId', 'tenantId', { unique: false });
                deptStore.createIndex('code', 'code', { unique: false });
            }

            // Categories store
            if (!database.objectStoreNames.contains('categories')) {
                const catStore = database.createObjectStore('categories', { keyPath: 'id' });
                catStore.createIndex('tenantId', 'tenantId', { unique: false });
            }

            // Items store
            if (!database.objectStoreNames.contains('items')) {
                const itemStore = database.createObjectStore('items', { keyPath: 'id' });
                itemStore.createIndex('categoryId', 'categoryId', { unique: false });
                itemStore.createIndex('tenantId', 'tenantId', { unique: false });
            }

            // Plans store
            if (!database.objectStoreNames.contains('plans')) {
                const planStore = database.createObjectStore('plans', { keyPath: 'id' });
                planStore.createIndex('tenantId', 'tenantId', { unique: false });
                planStore.createIndex('departmentId', 'departmentId', { unique: false });
                planStore.createIndex('status', 'status', { unique: false });
            }

            // PlanItems store (denormalized for quick access)
            if (!database.objectStoreNames.contains('planItems')) {
                const planItemStore = database.createObjectStore('planItems', { keyPath: 'id' });
                planItemStore.createIndex('planId', 'planId', { unique: false });
            }

            console.log('Database schema created');
        };
    });
}

// ============================================================================
// GENERIC CRUD HELPERS
// ============================================================================

function dbAdd(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbPut(storeName, data) {
    return new Promise((resolve, reject) => {
        console.log('[dbPut] Store:', storeName, 'Data ID:', data?.id, 'Full data:', data);

        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }

        if (!data || !data.id) {
            reject(new Error(`Invalid data for store ${storeName}: missing id field`));
            return;
        }

        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => {
            console.log('[dbPut] Success - stored with key:', request.result);
            resolve(request.result);
        };
        request.onerror = () => {
            console.error('[dbPut] Error:', request.error);
            reject(request.error);
        };
    });
}

function dbGet(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbGetAll(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbGetByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbGetOneByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.get(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbDelete(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function dbClear(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateDbId() {
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function simpleHash(str) {
    // Simple hash for demo purposes - NOT for production
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

async function authenticateUser(email, password) {
    const user = await dbGetOneByIndex('users', 'email', email.toLowerCase());
    if (!user) {
        return { success: false, error: 'User not found' };
    }

    if (user.passwordHash !== simpleHash(password)) {
        return { success: false, error: 'Invalid password' };
    }

    // Get tenant and department info
    const tenant = await dbGet('tenants', user.tenantId);
    let department = null;
    if (user.departmentId) {
        department = await dbGet('departments', user.departmentId);
    }

    return {
        success: true,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            initials: user.initials,
            role: user.role,
            roleTitle: user.role === 'po' ? 'Procurement Officer' : 'Departmental User',
            tenantId: user.tenantId,
            departmentId: user.departmentId,
            departmentName: department ? department.name : null,
            departmentCode: department ? department.code : null
        },
        tenant: tenant,
        department: department
    };
}

// ============================================================================
// PLAN FUNCTIONS
// ============================================================================

async function savePlan(planData) {
    const now = new Date().toISOString();

    // Generate ID explicitly and validate
    const planId = planData.id || generateDbId();
    console.log('[savePlan] Generated plan ID:', planId, typeof planId);

    if (!planId || typeof planId !== 'string') {
        throw new Error('Failed to generate valid plan ID');
    }

    const plan = {
        id: planId,
        tenantId: planData.tenantId || '',
        departmentId: planData.departmentId || '',
        departmentName: planData.departmentName || '',
        fiscalYear: planData.fiscalYear || '2025-2026',
        status: planData.status || 'draft',
        blocklyXml: planData.blocklyXml || '',
        totalCost: planData.totalCost || 0,
        itemCount: planData.itemCount || 0,
        submittedAt: planData.status === 'submitted' ? now : null,
        submittedBy: planData.submittedBy || null,
        createdAt: planData.createdAt || now,
        updatedAt: now
    };

    console.log('[savePlan] Plan object to save:', JSON.stringify(plan, null, 2));

    try {
        await dbPut('plans', plan);
        console.log('[savePlan] Plan saved successfully');
        return plan;
    } catch (error) {
        console.error('[savePlan] Error saving plan:', error);
        console.error('[savePlan] Plan object was:', plan);
        throw error;
    }
}

async function getPlansForDepartment(departmentId) {
    return await dbGetByIndex('plans', 'departmentId', departmentId);
}

async function getSubmittedPlans(tenantId) {
    const allPlans = await dbGetByIndex('plans', 'tenantId', tenantId);
    return allPlans.filter(p => p.status === 'submitted' || p.status === 'approved' || p.status === 'rejected');
}

async function getAllPlansForTenant(tenantId) {
    return await dbGetByIndex('plans', 'tenantId', tenantId);
}

async function updatePlanStatus(planId, status, reason = null) {
    const plan = await dbGet('plans', planId);
    if (!plan) {
        throw new Error('Plan not found');
    }

    plan.status = status;
    plan.updatedAt = new Date().toISOString();

    if (status === 'approved') {
        plan.approvedAt = new Date().toISOString();
    } else if (status === 'rejected') {
        plan.rejectedAt = new Date().toISOString();
        plan.rejectionReason = reason;
    }

    await dbPut('plans', plan);
    return plan;
}

// ============================================================================
// CATEGORY & ITEM FUNCTIONS
// ============================================================================

async function getCategoriesWithItems(tenantId) {
    const categories = await dbGetByIndex('categories', 'tenantId', tenantId);
    const items = await dbGetByIndex('items', 'tenantId', tenantId);

    return categories.map(cat => ({
        ...cat,
        items: items.filter(item => item.categoryId === cat.id)
    }));
}

async function getDepartments(tenantId) {
    return await dbGetByIndex('departments', 'tenantId', tenantId);
}

// ============================================================================
// SEED DATA
// ============================================================================

const TENANT_ID = 'tenant_pwani_university';

const SEED_DATA = {
    tenant: {
        id: TENANT_ID,
        name: 'Pwani University',
        code: 'PU',
        location: 'Kilifi, Kenya',
        fiscalYear: '2025-2026',
        totalBudget: 500000000,
        createdAt: new Date().toISOString()
    },

    users: [
        {
            id: 'user_po_1',
            tenantId: TENANT_ID,
            email: 'officer@pu.ac.ke',
            passwordHash: simpleHash('demo1234'),
            role: 'po',
            name: 'John Mwangi',
            initials: 'JM',
            departmentId: null,
            createdAt: new Date().toISOString()
        },
        {
            id: 'user_du_cs',
            tenantId: TENANT_ID,
            email: 'cs.head@pu.ac.ke',
            passwordHash: simpleHash('demo1234'),
            role: 'du',
            name: 'Mary Kamau',
            initials: 'MK',
            departmentId: 'dept_cs',
            createdAt: new Date().toISOString()
        },
        {
            id: 'user_du_eng',
            tenantId: TENANT_ID,
            email: 'eng.head@pu.ac.ke',
            passwordHash: simpleHash('demo1234'),
            role: 'du',
            name: 'Peter Ochieng',
            initials: 'PO',
            departmentId: 'dept_eng',
            createdAt: new Date().toISOString()
        },
        {
            id: 'user_du_bus',
            tenantId: TENANT_ID,
            email: 'bus.head@pu.ac.ke',
            passwordHash: simpleHash('demo1234'),
            role: 'du',
            name: 'Grace Wanjiku',
            initials: 'GW',
            departmentId: 'dept_bus',
            createdAt: new Date().toISOString()
        }
    ],

    departments: [
        {
            id: 'dept_cs',
            tenantId: TENANT_ID,
            name: 'Computer Science',
            code: 'CS-2025-Q1',
            budget: 50000000,
            headName: 'Mary Kamau',
            createdAt: new Date().toISOString()
        },
        {
            id: 'dept_eng',
            tenantId: TENANT_ID,
            name: 'Engineering',
            code: 'ENG-2025-Q1',
            budget: 75000000,
            headName: 'Peter Ochieng',
            createdAt: new Date().toISOString()
        },
        {
            id: 'dept_bus',
            tenantId: TENANT_ID,
            name: 'Business Studies',
            code: 'BUS-2025-Q1',
            budget: 40000000,
            headName: 'Grace Wanjiku',
            createdAt: new Date().toISOString()
        }
    ],

    categories: [
        { id: 'cat_1', name: 'Office Supplies', description: 'General office consumables' },
        { id: 'cat_2', name: 'IT Equipment', description: 'Computers, peripherals, networking' },
        { id: 'cat_3', name: 'Laboratory Equipment', description: 'Scientific and lab apparatus' },
        { id: 'cat_4', name: 'Furniture', description: 'Office and classroom furniture' },
        { id: 'cat_5', name: 'Stationery', description: 'Paper, pens, filing supplies' },
        { id: 'cat_6', name: 'Cleaning Supplies', description: 'Janitorial and cleaning materials' },
        { id: 'cat_7', name: 'Electrical Equipment', description: 'Electrical tools and supplies' },
        { id: 'cat_8', name: 'Safety Equipment', description: 'PPE and safety gear' },
        { id: 'cat_9', name: 'Teaching Materials', description: 'Educational aids and materials' },
        { id: 'cat_10', name: 'Sports Equipment', description: 'Athletic and recreational gear' },
        { id: 'cat_11', name: 'Maintenance Tools', description: 'Repair and maintenance equipment' },
        { id: 'cat_12', name: 'Communication Equipment', description: 'Phones, radios, AV equipment' },
        { id: 'cat_13', name: 'Medical Supplies', description: 'First aid and medical items' },
        { id: 'cat_14', name: 'Printing Services', description: 'Printing and publishing materials' },
        { id: 'cat_15', name: 'Vehicle Maintenance', description: 'Auto parts and services' }
    ]
};

// Items for each category (30 items each)
const CATEGORY_ITEMS = {
    'cat_1': [ // Office Supplies
        { description: 'A4 Printing Paper (Ream)', unit: 'Ream', unitPrice: 550, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Ballpoint Pens (Box of 50)', unit: 'Box', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Stapler Heavy Duty', unit: 'Pcs', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Staples (Box of 5000)', unit: 'Box', unitPrice: 180, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Paper Clips (Box of 100)', unit: 'Box', unitPrice: 85, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Binder Clips Assorted', unit: 'Box', unitPrice: 320, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Correction Fluid', unit: 'Pcs', unitPrice: 150, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Highlighters (Set of 6)', unit: 'Set', unitPrice: 380, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Sticky Notes (Pack)', unit: 'Pack', unitPrice: 250, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Desk Organizer', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Letter Tray (3-tier)', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Scissors Office', unit: 'Pcs', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Tape Dispenser', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Sellotape Rolls', unit: 'Pcs', unitPrice: 120, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Glue Stick', unit: 'Pcs', unitPrice: 95, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Rubber Bands (Pack)', unit: 'Pack', unitPrice: 180, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Push Pins (Box)', unit: 'Box', unitPrice: 150, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Whiteboard Markers (Set)', unit: 'Set', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Permanent Markers (Set)', unit: 'Set', unitPrice: 480, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Pencil Sharpener Electric', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Eraser (Pack of 10)', unit: 'Pack', unitPrice: 200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Ruler 30cm', unit: 'Pcs', unitPrice: 80, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Calculator Desktop', unit: 'Pcs', unitPrice: 1800, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Desk Calendar', unit: 'Pcs', unitPrice: 350, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Wall Calendar', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Notebook A5 (Pack of 10)', unit: 'Pack', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Envelope Brown A4 (Pack)', unit: 'Pack', unitPrice: 380, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Envelope White DL (Pack)', unit: 'Pack', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Box File', unit: 'Pcs', unitPrice: 320, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Lever Arch File', unit: 'Pcs', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' }
    ],
    'cat_2': [ // IT Equipment
        { description: 'Desktop Computer Core i5', unit: 'Pcs', unitPrice: 85000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Laptop Computer Core i7', unit: 'Pcs', unitPrice: 120000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'LED Monitor 24 inch', unit: 'Pcs', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Wireless Mouse', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'USB Keyboard', unit: 'Pcs', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'USB Flash Drive 32GB', unit: 'Pcs', unitPrice: 800, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'External Hard Drive 1TB', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Printer LaserJet', unit: 'Pcs', unitPrice: 45000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Toner Cartridge Black', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Network Switch 24-port', unit: 'Pcs', unitPrice: 35000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'WiFi Router Enterprise', unit: 'Pcs', unitPrice: 28000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'UPS 1500VA', unit: 'Pcs', unitPrice: 18000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Webcam HD 1080p', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Headset with Microphone', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Network Cable Cat6 (100m)', unit: 'Roll', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'RJ45 Connectors (Box)', unit: 'Box', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Server Rack 42U', unit: 'Pcs', unitPrice: 85000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Projector 4000 Lumens', unit: 'Pcs', unitPrice: 95000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Projection Screen 100 inch', unit: 'Pcs', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'HDMI Cable 5m', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Power Extension 6-way', unit: 'Pcs', unitPrice: 1800, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Surge Protector', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Laptop Bag', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Mouse Pad', unit: 'Pcs', unitPrice: 350, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Screen Cleaning Kit', unit: 'Set', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Compressed Air Duster', unit: 'Pcs', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Cable Ties (Pack)', unit: 'Pack', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Portable SSD 500GB', unit: 'Pcs', unitPrice: 12000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Graphics Tablet', unit: 'Pcs', unitPrice: 15000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Docking Station USB-C', unit: 'Pcs', unitPrice: 18000, procMethod: 'RFQ', sourceOfFunds: 'GOK' }
    ],
    'cat_3': [ // Laboratory Equipment
        { description: 'Microscope Compound', unit: 'Pcs', unitPrice: 85000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Microscope Slides (Box)', unit: 'Box', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Cover Slips (Box)', unit: 'Box', unitPrice: 1800, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Beakers Set (50-1000ml)', unit: 'Set', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Test Tubes (Pack of 50)', unit: 'Pack', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Test Tube Rack', unit: 'Pcs', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Bunsen Burner', unit: 'Pcs', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Tripod Stand', unit: 'Pcs', unitPrice: 2800, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Wire Gauze', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Retort Stand with Clamp', unit: 'Set', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Digital Balance 0.01g', unit: 'Pcs', unitPrice: 45000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'pH Meter Digital', unit: 'Pcs', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Centrifuge Machine', unit: 'Pcs', unitPrice: 120000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Hot Plate Stirrer', unit: 'Pcs', unitPrice: 35000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Fume Hood', unit: 'Pcs', unitPrice: 250000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Lab Coat White', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Safety Goggles', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Latex Gloves (Box)', unit: 'Box', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Pipette Set (Adjustable)', unit: 'Set', unitPrice: 35000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Pipette Tips (Pack)', unit: 'Pack', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Measuring Cylinder Set', unit: 'Set', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Conical Flask Set', unit: 'Set', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Volumetric Flask Set', unit: 'Set', unitPrice: 6500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Burette with Stand', unit: 'Set', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Funnel Set Glass', unit: 'Set', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Wash Bottle', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Lab Timer Digital', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Thermometer Digital', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Mortar and Pestle Set', unit: 'Set', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Desiccator Glass', unit: 'Pcs', unitPrice: 15000, procMethod: 'RFQ', sourceOfFunds: 'GOK' }
    ],
    'cat_4': [ // Furniture
        { description: 'Office Desk Executive', unit: 'Pcs', unitPrice: 45000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Office Chair Ergonomic', unit: 'Pcs', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Visitor Chair', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Filing Cabinet 4-Drawer', unit: 'Pcs', unitPrice: 35000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Bookshelf 5-tier', unit: 'Pcs', unitPrice: 18000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Conference Table 10-seater', unit: 'Pcs', unitPrice: 85000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Whiteboard 4x3 ft', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Notice Board Cork', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Reception Desk', unit: 'Pcs', unitPrice: 55000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Sofa 3-seater', unit: 'Pcs', unitPrice: 45000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Coffee Table', unit: 'Pcs', unitPrice: 12000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Computer Desk', unit: 'Pcs', unitPrice: 18000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Lecture Podium', unit: 'Pcs', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Student Desk with Chair', unit: 'Set', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Laboratory Stool', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Storage Cabinet Metal', unit: 'Pcs', unitPrice: 28000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Coat Rack Stand', unit: 'Pcs', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Waste Bin Office', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Desk Lamp LED', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Floor Mat Office', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Partition Screen', unit: 'Pcs', unitPrice: 15000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Wall Clock', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Key Cabinet', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Umbrella Stand', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Magazine Rack', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'TV Stand Mobile', unit: 'Pcs', unitPrice: 18000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Drawer Pedestal 3-drawer', unit: 'Pcs', unitPrice: 12000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Typing Chair', unit: 'Pcs', unitPrice: 6500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Dining Table 6-seater', unit: 'Pcs', unitPrice: 35000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Dining Chair', unit: 'Pcs', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' }
    ],
    'cat_5': [ // Stationery
        { description: 'Writing Pad A4', unit: 'Pcs', unitPrice: 150, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Spiral Notebook A4', unit: 'Pcs', unitPrice: 180, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Counter Book A4', unit: 'Pcs', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Visitors Book', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Receipt Book', unit: 'Pcs', unitPrice: 180, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Invoice Book', unit: 'Pcs', unitPrice: 220, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Duplicate Book', unit: 'Pcs', unitPrice: 250, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Carbon Paper (Pack)', unit: 'Pack', unitPrice: 350, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Colored Paper A4 (Ream)', unit: 'Ream', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Card Paper A4 (Pack)', unit: 'Pack', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Tracing Paper (Pack)', unit: 'Pack', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Graph Paper (Ream)', unit: 'Ream', unitPrice: 750, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Manila Paper (Pack)', unit: 'Pack', unitPrice: 550, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Foolscap Paper (Ream)', unit: 'Ream', unitPrice: 480, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Kraft Paper Roll', unit: 'Roll', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Laminating Pouches A4', unit: 'Pack', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Binding Combs (Pack)', unit: 'Pack', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Binding Covers (Pack)', unit: 'Pack', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Spiral Binding Ring', unit: 'Pack', unitPrice: 550, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Index Cards (Pack)', unit: 'Pack', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Index Dividers (Set)', unit: 'Set', unitPrice: 180, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Suspension Files (Box)', unit: 'Box', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Document Wallet', unit: 'Pcs', unitPrice: 85, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Plastic Folders Clear', unit: 'Pcs', unitPrice: 45, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Spring File', unit: 'Pcs', unitPrice: 120, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Presentation Folder', unit: 'Pcs', unitPrice: 180, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Expanding File 12-pocket', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Clipboard A4', unit: 'Pcs', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Name Badge Holder', unit: 'Pcs', unitPrice: 85, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Lanyard with Clip', unit: 'Pcs', unitPrice: 65, procMethod: 'RFQ', sourceOfFunds: 'GOK' }
    ],
    'cat_6': [ // Cleaning Supplies
        { description: 'Floor Mop Complete', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Mop Bucket with Wringer', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Broom Soft', unit: 'Pcs', unitPrice: 350, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Broom Hard', unit: 'Pcs', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Dustpan with Brush', unit: 'Set', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Floor Detergent 5L', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Toilet Cleaner 5L', unit: 'Pcs', unitPrice: 750, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Glass Cleaner 500ml', unit: 'Pcs', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Disinfectant 5L', unit: 'Pcs', unitPrice: 950, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Hand Soap Liquid 5L', unit: 'Pcs', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Hand Sanitizer 500ml', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Toilet Paper (Pack of 10)', unit: 'Pack', unitPrice: 550, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Paper Towels Roll', unit: 'Roll', unitPrice: 180, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Garbage Bags Large (Roll)', unit: 'Roll', unitPrice: 350, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Garbage Bags Small (Roll)', unit: 'Roll', unitPrice: 250, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Scouring Pad (Pack)', unit: 'Pack', unitPrice: 180, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Cleaning Cloth (Pack)', unit: 'Pack', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Rubber Gloves (Pair)', unit: 'Pair', unitPrice: 150, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Toilet Brush with Holder', unit: 'Set', unitPrice: 350, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Air Freshener Spray', unit: 'Pcs', unitPrice: 380, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Air Freshener Automatic', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Bleach 5L', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Window Squeegee', unit: 'Pcs', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Duster Feather', unit: 'Pcs', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Microfiber Cloth (Pack)', unit: 'Pack', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Floor Polish 5L', unit: 'Pcs', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Carpet Cleaner 5L', unit: 'Pcs', unitPrice: 950, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Drain Cleaner 1L', unit: 'Pcs', unitPrice: 380, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Spray Bottle Empty', unit: 'Pcs', unitPrice: 150, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Wet Floor Sign', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' }
    ],
    'cat_7': [ // Electrical Equipment
        { description: 'LED Bulb 12W (Pack of 10)', unit: 'Pack', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Fluorescent Tube 4ft', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Ceiling Fan', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Wall Fan', unit: 'Pcs', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Standing Fan', unit: 'Pcs', unitPrice: 6500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Air Conditioner Split 18000BTU', unit: 'Pcs', unitPrice: 85000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Extension Cable 10m', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Socket Outlet Double', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Light Switch', unit: 'Pcs', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Circuit Breaker MCB', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Distribution Board', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Electrical Wire 2.5mm (100m)', unit: 'Roll', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Electrical Tape (Pack)', unit: 'Pack', unitPrice: 350, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Cable Trunking 2m', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Junction Box', unit: 'Pcs', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Water Heater Instant', unit: 'Pcs', unitPrice: 12000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Electric Kettle 2L', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Microwave Oven', unit: 'Pcs', unitPrice: 15000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Water Dispenser Hot/Cold', unit: 'Pcs', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Refrigerator 200L', unit: 'Pcs', unitPrice: 45000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Voltage Stabilizer 5KVA', unit: 'Pcs', unitPrice: 18000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Emergency Light', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Smoke Detector', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Fire Alarm Bell', unit: 'Pcs', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Motion Sensor Light', unit: 'Pcs', unitPrice: 2800, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Solar Panel 100W', unit: 'Pcs', unitPrice: 15000, procMethod: 'RFQ', sourceOfFunds: 'Donor' },
        { description: 'Battery Inverter 12V', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Timer Switch Digital', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Doorbell Wireless', unit: 'Set', unitPrice: 1800, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'CCTV Camera Dome', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' }
    ],
    'cat_8': [ // Safety Equipment
        { description: 'Fire Extinguisher 6kg', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Fire Extinguisher 9kg', unit: 'Pcs', unitPrice: 12000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Fire Blanket', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'First Aid Kit Complete', unit: 'Set', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Safety Helmet', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Safety Boots', unit: 'Pair', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Safety Vest Reflective', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Safety Gloves Heavy Duty', unit: 'Pair', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Ear Muffs', unit: 'Pcs', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Ear Plugs (Box)', unit: 'Box', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Dust Mask N95 (Box)', unit: 'Box', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Face Shield', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Safety Harness Full Body', unit: 'Set', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Safety Net', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Traffic Cone', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Caution Tape Roll', unit: 'Roll', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Safety Sign Board', unit: 'Pcs', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Emergency Shower Station', unit: 'Pcs', unitPrice: 45000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Eye Wash Station', unit: 'Pcs', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Spill Kit Chemical', unit: 'Set', unitPrice: 15000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Stretcher Folding', unit: 'Pcs', unitPrice: 12000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Emergency Blanket', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Safety Padlock', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Lockout Tagout Kit', unit: 'Set', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Chemical Storage Cabinet', unit: 'Pcs', unitPrice: 35000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Safety Shower Curtain', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Emergency Torch LED', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Smoke Hood Escape', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Fire Hose Reel', unit: 'Set', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Assembly Point Sign', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' }
    ],
    'cat_9': [ // Teaching Materials
        { description: 'Textbook (Various)', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Reference Book', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Journal Subscription Annual', unit: 'Year', unitPrice: 45000, procMethod: 'Direct', sourceOfFunds: 'GOK' },
        { description: 'World Map Wall', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Globe Educational', unit: 'Pcs', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Human Anatomy Model', unit: 'Set', unitPrice: 35000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Skeleton Model Full', unit: 'Pcs', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Mathematical Set', unit: 'Set', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Geometry Box', unit: 'Pcs', unitPrice: 350, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Scientific Calculator', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Chalk Box White', unit: 'Box', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Chalk Box Colored', unit: 'Box', unitPrice: 350, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Duster Chalkboard', unit: 'Pcs', unitPrice: 150, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Pointer Stick', unit: 'Pcs', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Laser Pointer', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Flash Cards Set', unit: 'Set', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Educational Poster Set', unit: 'Set', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Alphabet Chart', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Number Chart', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Periodic Table Chart', unit: 'Pcs', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Biology Specimen Set', unit: 'Set', unitPrice: 15000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Chemistry Model Set', unit: 'Set', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Physics Kit Basic', unit: 'Set', unitPrice: 12000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Electronics Kit', unit: 'Set', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Robotics Kit Educational', unit: 'Set', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'Donor' },
        { description: 'Programming Kit Arduino', unit: 'Set', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Language Lab Headset', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Document Camera', unit: 'Pcs', unitPrice: 35000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Interactive Whiteboard', unit: 'Pcs', unitPrice: 150000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'E-Learning Software License', unit: 'Year', unitPrice: 25000, procMethod: 'Direct', sourceOfFunds: 'GOK' }
    ],
    'cat_10': [ // Sports Equipment
        { description: 'Football Size 5', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Basketball', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Volleyball', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Netball', unit: 'Pcs', unitPrice: 2800, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Rugby Ball', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Tennis Racket', unit: 'Pcs', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Tennis Ball (Pack)', unit: 'Pack', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Badminton Racket', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Shuttlecock (Pack)', unit: 'Pack', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Table Tennis Set', unit: 'Set', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Hockey Stick', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Hockey Ball', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Cricket Bat', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Cricket Ball', unit: 'Pcs', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Athletics Hurdle', unit: 'Pcs', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Shot Put', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Discus', unit: 'Pcs', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Javelin', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Starting Blocks', unit: 'Pair', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Stopwatch Digital', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Whistle Referee', unit: 'Pcs', unitPrice: 350, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Goal Net Football', unit: 'Pair', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Basketball Hoop', unit: 'Pcs', unitPrice: 15000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Volleyball Net', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Sports Cones (Set)', unit: 'Set', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Gym Mat', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Skipping Rope', unit: 'Pcs', unitPrice: 350, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Dumbbell Set', unit: 'Set', unitPrice: 15000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Sports Bag', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Ball Pump with Needle', unit: 'Set', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' }
    ],
    'cat_11': [ // Maintenance Tools
        { description: 'Toolbox Complete', unit: 'Set', unitPrice: 15000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Hammer Claw', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Screwdriver Set', unit: 'Set', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Pliers Set', unit: 'Set', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Adjustable Wrench', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Socket Set', unit: 'Set', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Electric Drill', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Drill Bit Set', unit: 'Set', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Angle Grinder', unit: 'Pcs', unitPrice: 6500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Circular Saw', unit: 'Pcs', unitPrice: 12000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Jigsaw Electric', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Measuring Tape 5m', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Spirit Level', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Ladder Aluminum 6ft', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Step Ladder 4ft', unit: 'Pcs', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Extension Ladder 20ft', unit: 'Pcs', unitPrice: 18000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Paint Brush Set', unit: 'Set', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Paint Roller Set', unit: 'Set', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Wall Paint 20L', unit: 'Bucket', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Pipe Wrench', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Hacksaw', unit: 'Pcs', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Hacksaw Blade (Pack)', unit: 'Pack', unitPrice: 350, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Utility Knife', unit: 'Pcs', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Welding Machine', unit: 'Pcs', unitPrice: 35000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Welding Helmet', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Welding Gloves', unit: 'Pair', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Wheelbarrow', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Shovel', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Pickaxe', unit: 'Pcs', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Garden Rake', unit: 'Pcs', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' }
    ],
    'cat_12': [ // Communication Equipment
        { description: 'Desk Phone IP', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Cordless Phone', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Conference Phone', unit: 'Pcs', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Two-Way Radio', unit: 'Pair', unitPrice: 12000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Public Address System', unit: 'Set', unitPrice: 85000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Microphone Wireless', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Microphone Stand', unit: 'Pcs', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Audio Mixer 8-channel', unit: 'Pcs', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Speaker Active 12 inch', unit: 'Pcs', unitPrice: 18000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Speaker Stand', unit: 'Pair', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Amplifier 500W', unit: 'Pcs', unitPrice: 15000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Audio Cable XLR 10m', unit: 'Pcs', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Video Camera HD', unit: 'Pcs', unitPrice: 85000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Camera Tripod', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'LED Video Light', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Green Screen', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Video Capture Card', unit: 'Pcs', unitPrice: 15000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Streaming Software License', unit: 'Year', unitPrice: 12000, procMethod: 'Direct', sourceOfFunds: 'GOK' },
        { description: 'Digital Signage Display', unit: 'Pcs', unitPrice: 45000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'Fax Machine', unit: 'Pcs', unitPrice: 15000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Intercom System', unit: 'Set', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Antenna TV', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Cable TV Decoder', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'TV LED 55 inch', unit: 'Pcs', unitPrice: 65000, procMethod: 'Open Tender', sourceOfFunds: 'GOK' },
        { description: 'TV Wall Mount', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Bluetooth Speaker Portable', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Podcast Microphone USB', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Audio Interface USB', unit: 'Pcs', unitPrice: 12000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Headphones Studio', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Recording Booth Portable', unit: 'Pcs', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'GOK' }
    ],
    'cat_13': [ // Medical Supplies
        { description: 'First Aid Box', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Bandage Roll (Pack)', unit: 'Pack', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Gauze Pads Sterile (Box)', unit: 'Box', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Adhesive Plasters (Box)', unit: 'Box', unitPrice: 350, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Cotton Wool (Roll)', unit: 'Roll', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Antiseptic Solution 500ml', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Spirit Surgical 500ml', unit: 'Pcs', unitPrice: 380, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Hydrogen Peroxide 500ml', unit: 'Pcs', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Pain Relief Tablets (Pack)', unit: 'Pack', unitPrice: 180, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Thermometer Digital', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Blood Pressure Monitor', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Stethoscope', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Glucose Monitor', unit: 'Set', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Glucose Test Strips (Box)', unit: 'Box', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Surgical Mask (Box)', unit: 'Box', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Examination Gloves (Box)', unit: 'Box', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Tongue Depressor (Box)', unit: 'Box', unitPrice: 350, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Syringe 5ml (Box)', unit: 'Box', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Ice Pack Reusable', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Hot Water Bottle', unit: 'Pcs', unitPrice: 380, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Wheelchair', unit: 'Pcs', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Crutches (Pair)', unit: 'Pair', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Walking Stick', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Neck Collar', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Arm Sling', unit: 'Pcs', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Eye Drops Sterile', unit: 'Pcs', unitPrice: 280, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Burn Gel', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Splint Set', unit: 'Set', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'CPR Face Shield (Pack)', unit: 'Pack', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'AED Defibrillator', unit: 'Pcs', unitPrice: 150000, procMethod: 'Open Tender', sourceOfFunds: 'Donor' }
    ],
    'cat_14': [ // Printing Services
        { description: 'Printing Paper A3 (Ream)', unit: 'Ream', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Printing Paper A4 Premium', unit: 'Ream', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Photo Paper Glossy A4', unit: 'Pack', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Banner Printing (per sqm)', unit: 'Sqm', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Poster Printing A1', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Business Cards (500)', unit: 'Set', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Letterhead Printing (500)', unit: 'Set', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Envelope Printing (500)', unit: 'Set', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Brochure Printing (per 100)', unit: 'Set', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Flyer Printing A5 (per 100)', unit: 'Set', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Certificate Printing', unit: 'Pcs', unitPrice: 150, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'ID Card Printing', unit: 'Pcs', unitPrice: 250, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'ID Card Holder', unit: 'Pcs', unitPrice: 85, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Lanyard Printed', unit: 'Pcs', unitPrice: 150, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'T-Shirt Printing', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Cap Printed', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Notebook Custom Printed', unit: 'Pcs', unitPrice: 350, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Pen Branded', unit: 'Pcs', unitPrice: 85, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Calendar Printing Desktop', unit: 'Pcs', unitPrice: 450, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Calendar Printing Wall', unit: 'Pcs', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Annual Report Printing', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Magazine Printing', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Book Printing Softcover', unit: 'Pcs', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Book Printing Hardcover', unit: 'Pcs', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Signage Board Printing', unit: 'Sqm', unitPrice: 2500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Vinyl Sticker Printing', unit: 'Sqm', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Roll-up Banner Stand', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'X-Banner Stand', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Stamp Rubber Custom', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Embossing Seal', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' }
    ],
    'cat_15': [ // Vehicle Maintenance
        { description: 'Engine Oil 5L', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Brake Fluid 1L', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Transmission Fluid 1L', unit: 'Pcs', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Coolant 5L', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Power Steering Fluid 1L', unit: 'Pcs', unitPrice: 950, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Oil Filter', unit: 'Pcs', unitPrice: 650, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Air Filter', unit: 'Pcs', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Fuel Filter', unit: 'Pcs', unitPrice: 750, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Spark Plug (Set of 4)', unit: 'Set', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Brake Pads (Set)', unit: 'Set', unitPrice: 4500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Brake Disc', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Wiper Blade (Pair)', unit: 'Pair', unitPrice: 1200, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Battery 12V 70AH', unit: 'Pcs', unitPrice: 15000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Headlight Bulb (Pair)', unit: 'Pair', unitPrice: 850, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Tire 195/65R15', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Tire 265/70R16', unit: 'Pcs', unitPrice: 15000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Wheel Alignment Service', unit: 'Service', unitPrice: 3500, procMethod: 'Direct', sourceOfFunds: 'GOK' },
        { description: 'Wheel Balancing Service', unit: 'Service', unitPrice: 1500, procMethod: 'Direct', sourceOfFunds: 'GOK' },
        { description: 'Car Wash Service', unit: 'Service', unitPrice: 500, procMethod: 'Direct', sourceOfFunds: 'GOK' },
        { description: 'Full Service (Minor)', unit: 'Service', unitPrice: 8500, procMethod: 'Direct', sourceOfFunds: 'GOK' },
        { description: 'Full Service (Major)', unit: 'Service', unitPrice: 25000, procMethod: 'Direct', sourceOfFunds: 'GOK' },
        { description: 'Windscreen Glass', unit: 'Pcs', unitPrice: 25000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Side Mirror', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Clutch Plate', unit: 'Pcs', unitPrice: 8500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Timing Belt', unit: 'Pcs', unitPrice: 3500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Fan Belt', unit: 'Pcs', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Radiator', unit: 'Pcs', unitPrice: 18000, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Shock Absorber', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Jack Hydraulic 3-ton', unit: 'Pcs', unitPrice: 5500, procMethod: 'RFQ', sourceOfFunds: 'GOK' },
        { description: 'Jump Start Cables', unit: 'Set', unitPrice: 1500, procMethod: 'RFQ', sourceOfFunds: 'GOK' }
    ]
};

async function seedTestData() {
    // Check if already seeded
    const existingTenant = await dbGet('tenants', TENANT_ID);
    if (existingTenant) {
        console.log('Database already seeded');
        return false;
    }

    console.log('Seeding test data...');

    // Add tenant
    await dbAdd('tenants', SEED_DATA.tenant);

    // Add users
    for (const user of SEED_DATA.users) {
        await dbAdd('users', user);
    }

    // Add departments
    for (const dept of SEED_DATA.departments) {
        await dbAdd('departments', dept);
    }

    // Add categories and items with error handling
    for (const cat of SEED_DATA.categories) {
        try {
            await dbAdd('categories', {
                ...cat,
                tenantId: TENANT_ID,
                createdAt: new Date().toISOString()
            });

            // Add items for this category
            const items = CATEGORY_ITEMS[cat.id] || [];
            let itemIndex = 0;
            for (const item of items) {
                try {
                    await dbAdd('items', {
                        id: `${cat.id}_item_${itemIndex++}_${Date.now()}`,
                        categoryId: cat.id,
                        tenantId: TENANT_ID,
                        description: item.description,
                        unit: item.unit,
                        unitPrice: item.unitPrice,
                        procMethod: item.procMethod,
                        sourceOfFunds: item.sourceOfFunds,
                        createdAt: new Date().toISOString()
                    });
                } catch (itemErr) {
                    console.warn(`Failed to add item ${item.description}:`, itemErr.message);
                }
            }
        } catch (catErr) {
            console.warn(`Failed to add category ${cat.name}:`, catErr.message);
        }
    }

    console.log('Test data seeded successfully!');
    console.log('Test Users:');
    console.log('  PO: officer@pu.ac.ke / demo1234');
    console.log('  DU (CS): cs.head@pu.ac.ke / demo1234');
    console.log('  DU (Eng): eng.head@pu.ac.ke / demo1234');
    console.log('  DU (Bus): bus.head@pu.ac.ke / demo1234');

    return true;
}

async function resetDatabase() {
    if (!confirm('This will delete ALL data and reset to test data. Continue?')) {
        return false;
    }

    console.log('Resetting database...');

    // Clear all stores
    await dbClear('tenants');
    await dbClear('users');
    await dbClear('departments');
    await dbClear('categories');
    await dbClear('items');
    await dbClear('plans');
    await dbClear('planItems');

    // Re-seed
    await seedTestData();

    console.log('Database reset complete!');
    return true;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initProcurelineDB() {
    try {
        await initDatabase();
        await seedTestData();
        console.log('Procureline DB initialized');
        return true;
    } catch (error) {
        console.error('Failed to initialize database:', error);
        return false;
    }
}

// Export functions for use in Procureline.html
window.ProcurelineDB = {
    init: initProcurelineDB,
    reset: resetDatabase,

    // Auth
    authenticate: authenticateUser,

    // Plans
    savePlan,
    getPlansForDepartment,
    getSubmittedPlans,
    getAllPlansForTenant,
    updatePlanStatus,

    // Data
    getCategoriesWithItems,
    getDepartments,

    // Raw access
    get: dbGet,
    getAll: dbGetAll,
    getByIndex: dbGetByIndex,
    put: dbPut,
    add: dbAdd,
    delete: dbDelete,

    // Constants
    TENANT_ID
};
