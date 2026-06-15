/**
 * ICC PrintHub - Firebase Utilities
 * Handles Firebase initialization, authentication, database, and storage operations
 */

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAzYEuCjArt628xRVqYY5vWoQNo2p71vfQ",
    authDomain: "icc-printhub.firebaseapp.com",
    databaseURL: "https://icc-printhub-default-rtdb.firebaseio.com",
    projectId: "icc-printhub",
    storageBucket: "icc-printhub.firebasestorage.app",
    messagingSenderId: "656827827016",
    appId: "1:656827827016:web:ba0494906bf9bf7d9d697d"
};

// Global file store (survives page navigation) - stores File objects for upload
let globalFileStore = [];

// Initialize Firebase (check if not already initialized)
let db, storage, auth, isFirebaseReady = false;

// Initialize Firebase immediately when page loads
function initFirebase() {
    if (typeof firebase === 'undefined') {
        console.warn('⚠️ Firebase SDK not loaded');
        return false;
    }

    try {
        if (firebase.apps && firebase.apps.length === 0) {
            console.log('🔧 Initializing Firebase...');
            firebase.initializeApp(firebaseConfig);
        }
        
        db = firebase.database();
        storage = firebase.storage();
        auth = firebase.auth();
        isFirebaseReady = true;
        console.log('✅ Firebase initialized successfully');
        return true;
    } catch (e) {
        console.error('❌ Firebase init error:', e.message);
        return false;
    }
}

// Try to initialize immediately
setTimeout(() => {
    if (!isFirebaseReady) {
        initFirebase();
    }
}, 100);

async function ensureFirebaseInitialized() {
    if (isFirebaseReady) return true;

    // Try to initialize if not already done
    if (initFirebase()) return true;

    // If still not ready, wait a bit more
    console.log('⏳ Waiting for Firebase SDK...');
    for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 100));
        if (initFirebase()) return true;
    }

    console.warn('⚠️ Firebase SDK not available, using demo mode');
    return false;
}

// Auto-initialize Firebase when SDK loads (non-blocking)
if (typeof firebase !== 'undefined') {
    initializeFirebaseApp().catch(e => console.error('Auto-init failed:', e.message));
}

/**
 * Store files globally (survives page navigation)
 */
function storeFilesGlobally(files) {
    globalFileStore = files;
    console.log('✓ Files stored in global store:', files.length);
    // Also keep in window for backwards compatibility
    window.uploadedFilesCache = files;
}

/**
 * Get files from global store
 */
function getStoredFiles() {
    return globalFileStore;
}

/**
 * Clear stored files
 */
function clearStoredFiles() {
    globalFileStore = [];
    window.uploadedFilesCache = [];
}

/**
 * Get Firebase Database reference (lazy init)
 */
function getDatabase() {
    if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded');
    }
    if (firebase.apps.length === 0) {
        throw new Error('Firebase app not initialized');
    }
    return firebase.database();
}

/**
 * Get Firebase Storage reference (lazy init)
 */
function getStorage() {
    if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded');
    }
    if (firebase.apps.length === 0) {
        throw new Error('Firebase app not initialized');
    }
    return firebase.storage();
}

/**
 * Get Firebase Auth reference (lazy init)
 */
function getAuth() {
    if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded');
    }
    if (firebase.apps.length === 0) {
        throw new Error('Firebase app not initialized');
    }
    return firebase.auth();
}

/**
 * Generate a unique Order ID
 * Format: ICC + timestamp + random
 */
function generateOrderId() {
    return 'ICC' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
}

/**
 * Save order to Firebase Database
 */
async function saveOrderToDatabase(orderData) {
    try {
        const database = getDatabase();
        await database.ref('orders/' + orderData.orderId).set(orderData);
        return orderData.orderId;
    } catch (error) {
        console.log('Firebase save failed, using demo mode:', error.message);
        // Demo mode - save to localStorage
        let orders = JSON.parse(localStorage.getItem('demoOrders') || '[]');
        orders.push(orderData);
        localStorage.setItem('demoOrders', JSON.stringify(orders));
        return orderData.orderId;
    }
}

/**
 * Upload file to Firebase Storage
 */
async function uploadFileToStorage(file, orderId, category, fileName) {
    if (!isFirebaseReady) {
        // Demo mode
        return {
            name: fileName,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString(),
            url: 'demo://local-storage'
        };
    }

    try {
        const storagePath = `orders/${orderId}/${category}/${fileName}`;
        const storageRef = storage.ref(storagePath);
        
        const snapshot = await storageRef.put(file);
        const downloadUrl = await snapshot.ref.getDownloadURL();

        // Save metadata
        const metadata = {
            fileName: fileName,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString(),
            url: downloadUrl
        };

        await db.ref(`orders/${orderId}/files/${fileName}`).set(metadata);
        
        return metadata;
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
}

/**
 * Create and place a new order
 */
async function createOrder(orderData) {
    try {
        const orderId = generateOrderId();
        
        const completeOrderData = {
            orderId: orderId,
            uid: localStorage.getItem('userUID'),
            category: orderData.category || 'General',
            files: orderData.files || [],
            pages: orderData.pages || 0,
            printSettings: orderData.printSettings || {},
            address: orderData.address || {},
            deliveryType: orderData.deliveryType || 'standard',
            totalAmount: orderData.totalAmount || 0,
            paymentStatus: 'Pending',
            orderStatus: 'Pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save to database
        await saveOrderToDatabase(completeOrderData);
        
        return orderId;
    } catch (error) {
        console.error('Error creating order:', error);
        throw error;
    }
}

/**
 * Get order by ID
 */
async function getOrder(orderId) {
    if (!isFirebaseReady) {
        // Demo mode
        const orders = JSON.parse(localStorage.getItem('demoOrders') || '[]');
        return orders.find(o => o.orderId === orderId);
    }

    try {
        const snapshot = await db.ref('orders/' + orderId).once('value');
        return snapshot.val();
    } catch (error) {
        console.error('Error fetching order:', error);
        throw error;
    }
}

/**
 * Get all orders for a user
 */
async function getUserOrders(uid) {
    if (!isFirebaseReady) {
        // Demo mode
        const orders = JSON.parse(localStorage.getItem('demoOrders') || '[]');
        return orders.filter(o => o.uid === uid);
    }

    try {
        const snapshot = await db.ref('orders').orderByChild('uid').equalTo(uid).once('value');
        const orders = [];
        snapshot.forEach((childSnapshot) => {
            orders.push(childSnapshot.val());
        });
        return orders;
    } catch (error) {
        console.error('Error fetching user orders:', error);
        throw error;
    }
}

/**
 * Update order status
 */
async function updateOrderStatus(orderId, newStatus) {
    if (!isFirebaseReady) {
        // Demo mode
        const orders = JSON.parse(localStorage.getItem('demoOrders') || '[]');
        const order = orders.find(o => o.orderId === orderId);
        if (order) {
            order.orderStatus = newStatus;
            order.updatedAt = new Date().toISOString();
            localStorage.setItem('demoOrders', JSON.stringify(orders));
        }
        return order;
    }

    try {
        const updates = {
            orderStatus: newStatus,
            updatedAt: new Date().toISOString()
        };
        await db.ref('orders/' + orderId).update(updates);
        return await getOrder(orderId);
    } catch (error) {
        console.error('Error updating order:', error);
        throw error;
    }
}

/**
 * Update payment status
 */
async function updatePaymentStatus(orderId, paymentStatus, transactionId = null) {
    if (!isFirebaseReady) {
        // Demo mode
        const orders = JSON.parse(localStorage.getItem('demoOrders') || '[]');
        const order = orders.find(o => o.orderId === orderId);
        if (order) {
            order.paymentStatus = paymentStatus;
            if (transactionId) order.transactionId = transactionId;
            order.updatedAt = new Date().toISOString();
            localStorage.setItem('demoOrders', JSON.stringify(orders));
        }
        return order;
    }

    try {
        const updates = {
            paymentStatus: paymentStatus,
            updatedAt: new Date().toISOString()
        };
        if (transactionId) updates.transactionId = transactionId;
        
        await db.ref('orders/' + orderId).update(updates);
        return await getOrder(orderId);
    } catch (error) {
        console.error('Error updating payment:', error);
        throw error;
    }
}

/**
 * Save delivery address to user profile
 */
async function saveUserAddress(uid, address) {
    if (!isFirebaseReady) {
        localStorage.setItem('userAddress', JSON.stringify(address));
        return address;
    }

    try {
        await db.ref('users/' + uid + '/address').set(address);
        return address;
    } catch (error) {
        console.error('Error saving address:', error);
        throw error;
    }
}

/**
 * Get user address
 */
async function getUserAddress(uid) {
    if (!isFirebaseReady) {
        return JSON.parse(localStorage.getItem('userAddress') || '{}');
    }

    try {
        const snapshot = await db.ref('users/' + uid + '/address').once('value');
        return snapshot.val() || {};
    } catch (error) {
        console.error('Error fetching address:', error);
        throw error;
    }
}

/**
 * Listen to order status in realtime
 */
function listenToOrderStatus(orderId, callback) {
    if (!isFirebaseReady) {
        const orders = JSON.parse(localStorage.getItem('demoOrders') || '[]');
        const order = orders.find(o => o.orderId === orderId);
        if (order) callback(order);
        return () => {};
    }

    try {
        const unsubscribe = db.ref('orders/' + orderId).on('value', (snapshot) => {
            callback(snapshot.val());
        });
        return () => db.ref('orders/' + orderId).off('value');
    } catch (error) {
        console.error('Error listening to order:', error);
        return () => {};
    }
}

/**
 * Calculate estimated delivery date
 */
function getEstimatedDeliveryDate(deliveryType = 'standard', orderDate = new Date()) {
    const date = new Date(orderDate);
    const daysToAdd = deliveryType === 'express' ? 1 : 3;
    date.setDate(date.getDate() + daysToAdd);
    return date;
}

/**
 * Format price to INR
 */
function formatPrice(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
    }).format(amount);
}

/**
 * Validate address
 */
function validateAddress(address) {
    const errors = [];
    
    if (!address.fullName || address.fullName.trim().length < 3) {
        errors.push('Full name must be at least 3 characters');
    }
    
    if (!address.mobileNumber || !/^[0-9]{10}$/.test(address.mobileNumber)) {
        errors.push('Mobile number must be 10 digits');
    }
    
    if (!address.addressLine1 || address.addressLine1.trim().length < 5) {
        errors.push('Address is too short');
    }
    
    if (!address.city || address.city.trim().length < 2) {
        errors.push('City is required');
    }
    
    if (!address.state || address.state.trim().length < 2) {
        errors.push('State is required');
    }
    
    if (!address.pincode || !/^[0-9]{6}$/.test(address.pincode)) {
        errors.push('Pincode must be 6 digits');
    }
    
    return errors;
}

/**
 * Get pricing information
 */
const PRICING = {
    'B/W': 0.50,
    'Color': 3.00,
    'Spiral': 35,
    'Staple': 5,
    'Hard': 50,
    'None': 0,
    'transparentCover': 10,
    'backSheet': 5,
    'lamination': 15,
    'delivery_standard': 0,
    'delivery_express': 50
};

/**
 * Calculate order total
 */
function calculateOrderTotal(pages, printType, copies, binding = 'None', extras = {}, deliveryType = 'standard') {
    let total = 0;
    
    // Print cost
    total += pages * (PRICING[printType] || 0) * copies;
    
    // Binding
    total += PRICING[binding] || 0;
    
    // Extras
    if (extras.transparentCover) total += PRICING.transparentCover;
    if (extras.backSheet) total += PRICING.backSheet;
    if (extras.lamination) total += PRICING.lamination;
    
    // Delivery
    total += PRICING['delivery_' + deliveryType] || 0;
    
    // Tax (18% GST)
    total = total * 1.18;
    
    return parseFloat(total.toFixed(2));
}

/**
 * PRODUCTION-READY: Place order with complete file upload flow
 * Uploads all files to Firebase Storage, gets download URLs, and saves complete order
 * Only redirects after ALL operations complete successfully
 */
async function placeOrderWithFileUpload(orderMetadata) {
    console.log('=== ORDER PLACEMENT INITIATED ===');
    
    // ===== VERIFICATION PHASE =====
    console.log('1. ENSURING FIREBASE IS INITIALIZED');
    
    // Ensure Firebase SDK is loaded and initialized
    let isProduction = false;
    try {
        isProduction = await ensureFirebaseInitialized();
        if (!isProduction) {
            console.log('   ⚠ Firebase not available, will use demo mode with localStorage');
        } else {
            console.log('   ✓ Firebase initialized successfully');
        }
    } catch (error) {
        console.warn('Firebase initialization warning:', error.message);
        console.log('   ⚠ Will continue in demo mode');
        isProduction = false;
    }
    
    // Check Firebase availability (but allow demo mode if not available)
    if (isProduction) {
        if (typeof firebase === 'undefined') {
            console.warn('⚠ Firebase SDK not loaded, switching to demo mode');
            isProduction = false;
        } else {
            console.log('   ✓ Firebase SDK available');
        }
        
        if (isProduction && (!firebase.apps || firebase.apps.length === 0)) {
            console.warn('⚠ Firebase apps not initialized, switching to demo mode');
            isProduction = false;
        }
    }
    
    // Check authentication
    console.log('2. VERIFYING USER AUTHENTICATION');
    
    let uid;
    if (isProduction && typeof firebase !== 'undefined') {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            throw new Error('User is not authenticated. Please login before placing an order.');
        }
        uid = currentUser.uid;
        console.log('   ✓ Authenticated user (Firebase):', uid);
    } else {
        // Demo mode: use localStorage UID
        uid = localStorage.getItem('userUID');
        if (!uid) {
            throw new Error('User is not authenticated. Please login before placing an order.');
        }
        console.log('   ✓ Authenticated user (Demo mode):', uid);
    }
    
    // Get stored files from global store
    console.log('3. RETRIEVING STORED FILES');
    let uploadedFilesCache = window.globalFileStore || window.uploadedFilesCache || [];
    
    // If no files in window, try to reconstruct from sessionStorage (for page navigation)
    if (!uploadedFilesCache || uploadedFilesCache.length === 0) {
        console.log('   ⏳ Files not in window, checking sessionStorage...');
        const fileDataStr = sessionStorage.getItem('uploadFilesData');
        
        if (fileDataStr) {
            try {
                const fileDataArray = JSON.parse(fileDataStr);
                console.log('   ✓ Found', fileDataArray.length, 'files in sessionStorage');
                
                // Reconstruct File objects from stored data
                uploadedFilesCache = fileDataArray.map(fd => {
                    const binaryData = new Uint8Array(fd.data);
                    const blob = new Blob([binaryData], { type: fd.type });
                    const file = new File([blob], fd.name, { type: fd.type });
                    
                    return {
                        name: fd.name,
                        type: fd.type,
                        size: fd.size,
                        file: file
                    };
                });
                
                console.log('   ✓ Files reconstructed from sessionStorage');
                window.globalFileStore = uploadedFilesCache;
                window.uploadedFilesCache = uploadedFilesCache;
            } catch (e) {
                console.error('   ✗ Error reconstructing files:', e.message);
                uploadedFilesCache = [];
            }
        }
    }
    
    if (!uploadedFilesCache || uploadedFilesCache.length === 0) {
        throw new Error('No files found in store. Files must be uploaded before placing an order.');
    }
    
    console.log('   ✓ Files count:', uploadedFilesCache.length);
    uploadedFilesCache.forEach((f, i) => {
        console.log(`      [${i+1}] ${f.name} (${(f.size / 1024).toFixed(2)} KB)`);
    });
    
    // ===== PREPARE ORDER DATA =====
    console.log('4. PREPARING ORDER DATA');
    const orderId = generateOrderId();
    const timestamp = Date.now();
    
    console.log('   ✓ Order ID generated:', orderId);
    console.log('   ✓ Timestamp:', new Date(timestamp).toISOString());
    console.log('   ✓ Category:', orderMetadata.category);
    
    // ===== FILE UPLOAD PHASE =====
    if (isProduction) {
        console.log('5. UPLOADING FILES TO FIREBASE STORAGE');
        console.log(`   Path template: orders/${uid}/${orderId}/${orderMetadata.category}/{filename}`);
    } else {
        console.log('5. PROCESSING FILES (DEMO MODE - localStorage)');
    }
    
    const uploadedFileMetadata = [];
    let uploadIndex = 0;
    
    for (const file of uploadedFilesCache) {
        uploadIndex++;
        console.log(`\n   [${uploadIndex}/${uploadedFilesCache.length}] ${isProduction ? 'Uploading' : 'Processing'}: ${file.name}`);
        
        try {
            let fileMetadata;
            
            if (isProduction) {
                // Production: Upload to Firebase Storage
                const storagePath = `orders/${uid}/${orderId}/${orderMetadata.category}/${file.name}`;
                console.log(`      Storage path: ${storagePath}`);
                
                const storageRef = firebase.storage().ref(storagePath);
                console.log('      ✓ Storage reference created');
                
                console.log('      ⏳ Uploading...');
                // Get the actual File object (file property contains the real File)
                const actualFile = file.file || file;
                const snapshot = await storageRef.put(actualFile, {
                    customMetadata: {
                        'uploadTime': new Date(timestamp).toISOString(),
                        'orderId': orderId,
                        'uid': uid
                    }
                });
                
                console.log(`      ✓ Upload complete (${snapshot.bytesTransferred} bytes)`);
                
                console.log('      ⏳ Fetching download URL...');
                const downloadURL = await snapshot.ref.getDownloadURL();
                console.log('      ✓ Download URL:', downloadURL.substring(0, 50) + '...');
                
                fileMetadata = {
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    downloadURL: downloadURL,
                    uploadTime: new Date(timestamp).toISOString(),
                    uploadedAt: new Date(timestamp).toISOString()
                };
            } else {
                // Demo mode: Create mock file metadata
                fileMetadata = {
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    downloadURL: 'demo://local-storage/' + file.name,
                    uploadTime: new Date(timestamp).toISOString(),
                    uploadedAt: new Date(timestamp).toISOString()
                };
                console.log('      ✓ File metadata created (demo mode)');
            }
            
            uploadedFileMetadata.push(fileMetadata);
            console.log('      ✓ File metadata created');
            
        } catch (uploadError) {
            console.error(`      ✗ ${isProduction ? 'UPLOAD' : 'PROCESSING'} FAILED for ${file.name}:`, uploadError);
            throw new Error(`Failed to ${isProduction ? 'upload' : 'process'} file "${file.name}": ${uploadError.message}`);
        }
    }
    
    console.log(`\n   ✓ All ${uploadedFileMetadata.length} files ${isProduction ? 'uploaded' : 'processed'} successfully`);
    
    // ===== DATABASE SAVE PHASE =====
    console.log('\n6. SAVING ORDER TO DATABASE');
    
    // Create complete order object
    const completeOrderData = {
        orderId: orderId,
        uid: uid,
        category: orderMetadata.category,
        files: uploadedFileMetadata,
        pages: orderMetadata.pages || 0,
        printSettings: orderMetadata.printSettings || {},
        address: orderMetadata.address || {},
        deliveryType: orderMetadata.deliveryType || 'standard',
        totalAmount: orderMetadata.totalAmount || 0,
        paymentStatus: 'Pending',
        orderStatus: 'Pending',
        createdAt: timestamp,
        createdAtISO: new Date(timestamp).toISOString(),
        updatedAt: timestamp,
        updatedAtISO: new Date(timestamp).toISOString(),
        mode: isProduction ? 'Firebase' : 'Demo'
    };
    
    console.log('   ✓ Order object created:');
    console.log('      - orderId:', completeOrderData.orderId);
    console.log('      - uid:', completeOrderData.uid);
    console.log('      - files:', completeOrderData.files.length);
    console.log('      - pages:', completeOrderData.pages);
    console.log('      - totalAmount:', completeOrderData.totalAmount);
    console.log('      - mode:', completeOrderData.mode);
    
    try {
        if (isProduction) {
            // Save to Firebase Realtime Database
            console.log(`   ⏳ Writing to Firebase /orders/${orderId}`);
            const database = getDatabase();
            await database.ref(`orders/${orderId}`).set(completeOrderData);
            console.log(`   ✓ Order saved to /orders/${orderId}`);
            
            console.log(`   ⏳ Writing user reference to /users/${uid}/orders/${orderId}`);
            await database.ref(`users/${uid}/orders/${orderId}`).set({
                orderId: orderId,
                category: orderMetadata.category,
                totalAmount: orderMetadata.totalAmount,
                createdAt: timestamp,
                createdAtISO: new Date(timestamp).toISOString(),
                orderStatus: 'Pending'
            });
            console.log(`   ✓ User reference saved`);
        } else {
            // Demo mode: Save to localStorage
            console.log('   ⏳ Saving to localStorage (demo mode)');
            let demoOrders = JSON.parse(localStorage.getItem('demoOrders') || '[]');
            demoOrders.push(completeOrderData);
            localStorage.setItem('demoOrders', JSON.stringify(demoOrders));
            console.log('   ✓ Order saved to demoOrders in localStorage');
            console.log('   ✓ Total demo orders:', demoOrders.length);
        }
    } catch (dbError) {
        console.error('   ✗ DATABASE WRITE FAILED:', dbError);
        throw new Error(`Failed to save order: ${dbError.message}`);
    }
    
    // ===== SUCCESS PHASE =====
    console.log('\n=== ORDER PLACEMENT SUCCESSFUL ===');
    console.log('Mode:', isProduction ? 'Production (Firebase)' : 'Demo (localStorage)');
    console.log('Final Order JSON:');
    console.log(JSON.stringify(completeOrderData, null, 2));
    console.log('\n✓ Ready to redirect to order-success.html...');
    
    return {
        success: true,
        orderId: orderId,
        orderData: completeOrderData
    };
}

/**
 * Export functions
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateOrderId,
        saveOrderToDatabase,
        uploadFileToStorage,
        createOrder,
        getOrder,
        getUserOrders,
        updateOrderStatus,
        updatePaymentStatus,
        saveUserAddress,
        getUserAddress,
        listenToOrderStatus,
        getEstimatedDeliveryDate,
        formatPrice,
        validateAddress,
        PRICING,
        calculateOrderTotal,
        isFirebaseReady
    };
}
