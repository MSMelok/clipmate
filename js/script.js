import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    deleteDoc, 
    updateDoc,
    onSnapshot,
    query,
    where,
    orderBy
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

// DOM Elements
const userEmailElement = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const addClipboardBtn = document.getElementById('add-clipboard-btn');
const syncBtn = document.getElementById('sync-btn');
const clipboardItemsContainer = document.getElementById('clipboard-items');
const clipboardItemTemplate = document.getElementById('clipboard-item-template');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const darkIcon = document.getElementById('dark-icon');
const lightIcon = document.getElementById('light-icon');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
const modal = document.getElementById('confirmation-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalCancelBtn = document.getElementById('modal-cancel');
const modalConfirmBtn = document.getElementById('modal-confirm');
const loadingOverlay = document.getElementById('loading-overlay');
const emptyState = document.getElementById('empty-state');

// Current user and clipboard data
let currentUser = null;
let clipboardItems = [];
let unsubscribeSnapshot = null;
let syncInterval = null;
let lastSyncTime = null;

// Initialize the app
function init() {
    setupEventListeners();
    checkTheme();
    setupAuthStateListener();
}

// Set up event listeners
function setupEventListeners() {
    logoutBtn.addEventListener('click', handleLogout);
    addClipboardBtn.addEventListener('click', addNewClipboardItem);
    syncBtn.addEventListener('click', () => syncClipboardItems(true)); // Pass true for manual sync
    themeToggleBtn.addEventListener('click', toggleTheme);
    modalCancelBtn.addEventListener('click', closeModal);

    // Custom events for clipboard actions
    clipboardItemsContainer.addEventListener('copy-item', handleCopyItem);
    clipboardItemsContainer.addEventListener('delete-item', handleDeleteItem);
    clipboardItemsContainer.addEventListener('update-item', handleUpdateItem);
}

// Check and apply the saved theme
function checkTheme() {
    const savedTheme = localStorage.getItem('clipmate-theme') || 'dark';
    document.body.classList.toggle('light-theme', savedTheme === 'light');
    updateThemeIcons(savedTheme === 'light');
}

// Toggle between light and dark themes
function toggleTheme() {
    const isLightTheme = document.body.classList.toggle('light-theme');
    updateThemeIcons(isLightTheme);
    localStorage.setItem('clipmate-theme', isLightTheme ? 'light' : 'dark');
}

// Update theme icons visibility
function updateThemeIcons(isLightTheme) {
    darkIcon.style.display = isLightTheme ? 'block' : 'none';
    lightIcon.style.display = isLightTheme ? 'none' : 'block';
}

// Set up Firebase auth state listener
function setupAuthStateListener() {
    showLoading();
    onAuthStateChanged(auth, (user) => {
        hideLoading();
        if (user) {
            // User is signed in
            currentUser = user;
            userEmailElement.textContent = user.email;
            
            // Load initial clipboard items
            loadClipboardItems();
            
            // Set up 30-second sync interval to check for changes
            setupSyncInterval();
        } else {
            // User is signed out, redirect to login page
            window.location.href = './index.html';
            
            // Clear sync interval if it exists
            clearSyncInterval();
        }
    });
}

// Set up an automatic sync interval that checks for changes every 30 seconds
function setupSyncInterval() {
    // Clear any existing interval first
    clearSyncInterval();
    
    // Initialize last sync time
    lastSyncTime = new Date();
    
    // Set up a new sync interval
    syncInterval = setInterval(() => {
        syncClipboardItems();
    }, 30000); // 30 seconds
    
    console.log('Auto sync enabled: checking for changes every 30 seconds');
}

// Clear the sync interval
function clearSyncInterval() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
        console.log('Sync interval cleared');
    }
}

// Synchronize clipboard items from Firestore
function syncClipboardItems(isManualSync = false) {
    console.log('Syncing clipboard items...');
    
    // Don't sync if user isn't authenticated
    if (!currentUser) {
        console.log('No user logged in, skipping sync');
        return;
    }
    
    // Don't sync if any textarea is currently focused (user is typing)
    if (document.activeElement && document.activeElement.classList.contains('clipboard-input')) {
        console.log('User is currently typing, postponing sync');
        if (isManualSync) {
            showToast('Cannot sync while typing. Please click outside the text area first.');
        }
        return;
    }
    
    // Add syncing class to show animation (only if manual sync or button exists)
    if (syncBtn) {
        syncBtn.classList.add('syncing');
    }
    
    try {
        // Create a reference to the clipboardItems collection
        const clipboardItemsRef = collection(db, 'clipboardItems');
        
        // Create a query for the current user's clipboard items
        const clipboardQuery = query(
            clipboardItemsRef,
            where('userId', '==', currentUser.uid)
        );
        
        // Get all clipboard items
        getDocs(clipboardQuery)
            .then((snapshot) => {
                const serverItems = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                // Check if any items have changed since last sync
                const hasChanges = checkForChanges(serverItems);
                
                if (hasChanges) {
                    console.log('Changes detected during sync, updating clipboard items');
                    
                    // Save the currently focused element and its position
                    const focusedElement = document.activeElement;
                    let selectionStart = null;
                    let selectionEnd = null;
                    
                    if (focusedElement && focusedElement.tagName === 'TEXTAREA') {
                        selectionStart = focusedElement.selectionStart;
                        selectionEnd = focusedElement.selectionEnd;
                    }
                    
                    // Remember the scroll position
                    const scrollPosition = window.scrollY;
                    
                    // Update the clipboard items and UI
                    clipboardItems = serverItems;
                    renderClipboardItems();
                    
                    // Restore focus and selection if applicable
                    if (focusedElement && focusedElement.id) {
                        const newElement = document.getElementById(focusedElement.id);
                        if (newElement) {
                            newElement.focus();
                            if (selectionStart !== null && selectionEnd !== null) {
                                newElement.selectionStart = selectionStart;
                                newElement.selectionEnd = selectionEnd;
                            }
                        }
                    }
                    
                    // Restore scroll position
                    window.scrollTo(0, scrollPosition);
                    
                    // Show toast to indicate sync was successful with changes (only for manual sync)
                    if (isManualSync) {
                        showToast('Synchronized clipboard items');
                    }
                } else {
                    console.log('No changes detected during sync');
                    if (isManualSync) {
                        showToast('No changes detected');
                    }
                }
                
                // Update the last sync time
                lastSyncTime = new Date();
                
                // Remove syncing class
                if (syncBtn) {
                    syncBtn.classList.remove('syncing');
                }
            })
            .catch((error) => {
                console.error('Error syncing clipboard items:', error);
                if (isManualSync) {
                    showToast('Error syncing clipboard items');
                }
                // Remove syncing class on error
                if (syncBtn) {
                    syncBtn.classList.remove('syncing');
                }
            });
    } catch (error) {
        console.error('Error during clipboard sync:', error);
        if (isManualSync) {
            showToast('Error during sync operation');
        }
        // Remove syncing class on error
        if (syncBtn) {
            syncBtn.classList.remove('syncing');
        }
    }
}

// Check if there are any changes between local and server clipboard items
function checkForChanges(serverItems) {
    // If the number of items is different, there are changes
    if (clipboardItems.length !== serverItems.length) {
        return true;
    }
    
    // Create a map of local items by ID for easy lookup
    const localItemsMap = {};
    clipboardItems.forEach(item => {
        localItemsMap[item.id] = item;
    });
    
    // Check if any server items are missing from local or have different content
    for (const serverItem of serverItems) {
        const localItem = localItemsMap[serverItem.id];
        
        // If the item doesn't exist locally or has different content, there are changes
        if (!localItem || localItem.content !== serverItem.content) {
            return true;
        }
    }
    
    return false;
}

// Load clipboard items from Firestore
function loadClipboardItems() {
    showLoading();
    
    // Unsubscribe from previous listener if exists
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
    }
    
    try {
        // Create a reference to the clipboardItems collection
        const clipboardItemsRef = collection(db, 'clipboardItems');
        
        // Create a query for the current user's clipboard items
        const clipboardQuery = query(
            clipboardItemsRef,
            where('userId', '==', currentUser.uid)
        );
        
        // Set up real-time listener
        unsubscribeSnapshot = onSnapshot(clipboardQuery, (snapshot) => {
            clipboardItems = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            renderClipboardItems();
            hideLoading();
        }, (error) => {
            console.error("Error getting clipboard items: ", error);
            showToast('Error loading clipboard items');
            hideLoading();
            
            // Still show the empty state if there's an error
            renderClipboardItems();
        });
    } catch (error) {
        console.error("Error setting up clipboard listener: ", error);
        showToast('Error setting up data connection');
        hideLoading();
        
        // Show empty state
        emptyState.style.display = 'flex';
    }
}

// Render clipboard items to the DOM
function renderClipboardItems() {
    // Clear existing items
    clipboardItemsContainer.innerHTML = '';
    
    // Show empty state if no items
    if (clipboardItems.length === 0) {
        emptyState.style.display = 'flex';
    } else {
        emptyState.style.display = 'none';
        
        // Render each clipboard item
        clipboardItems.forEach(item => {
            const clipboardItemElement = createClipboardItemElement(item);
            clipboardItemsContainer.appendChild(clipboardItemElement);
        });
        
        // Initialize Feather icons
        feather.replace();
    }
}

// Create a clipboard item element
function createClipboardItemElement(item) {
    // Clone the template
    const clipboardItem = clipboardItemTemplate.content.cloneNode(true);
    const clipboardItemContainer = clipboardItem.querySelector('.clipboard-item');
    const textarea = clipboardItem.querySelector('.clipboard-input');
    const copyBtn = clipboardItem.querySelector('.copy-btn');
    const deleteBtn = clipboardItem.querySelector('.delete-btn');
    
    // Set data and content
    clipboardItemContainer.dataset.id = item.id;
    textarea.value = item.content;
    
    // Assign a unique ID to the textarea for focus tracking
    textarea.id = `clipboard-input-${item.id}`;
    
    // Add event listeners
    copyBtn.addEventListener('click', () => {
        const customEvent = new CustomEvent('copy-item', {
            detail: { id: item.id, content: textarea.value }
        });
        clipboardItemsContainer.dispatchEvent(customEvent);
    });
    
    deleteBtn.addEventListener('click', () => {
        const customEvent = new CustomEvent('delete-item', {
            detail: { id: item.id, content: textarea.value }
        });
        clipboardItemsContainer.dispatchEvent(customEvent);
    });
    
    // Add input event listener for auto-save
    textarea.addEventListener('input', debounce(() => {
        const customEvent = new CustomEvent('update-item', {
            detail: { id: item.id, content: textarea.value }
        });
        clipboardItemsContainer.dispatchEvent(customEvent);
    }, 500));
    
    return clipboardItemContainer;
}

// Add a new clipboard item
function addNewClipboardItem() {
    showLoading();
    
    try {
        // Create a Firestore timestamp
        const timestamp = new Date();
        
        // Create a new document in the clipboardItems collection
        addDoc(collection(db, 'clipboardItems'), {
            userId: currentUser.uid,
            content: '',
            createdAt: timestamp,
            updatedAt: timestamp
        })
        .then(() => {
            hideLoading();
            showToast('New clipboard item added');
            // No need to manually add item here as the Firestore listener will update the UI
        })
        .catch(error => {
            console.error("Error adding clipboard item: ", error);
            showToast('Error adding new clipboard item');
            hideLoading();
        });
    } catch (error) {
        console.error("Failed to add clipboard item: ", error);
        showToast('Failed to add clipboard item');
        hideLoading();
    }
}

// Handle copying clipboard item content
function handleCopyItem(event) {
    const { id, content } = event.detail;
    
    // Copy to clipboard
    navigator.clipboard.writeText(content)
        .then(() => {
            showToast('Copied to clipboard!');
        })
        .catch(error => {
            console.error('Could not copy text: ', error);
            showToast('Failed to copy to clipboard');
        });
}

// Handle deleting clipboard item
function handleDeleteItem(event) {
    const { id, content } = event.detail;
    
    // Check if item has content
    if (content.trim()) {
        // Show confirmation modal
        modalTitle.textContent = 'Confirm Delete';
        modalMessage.textContent = 'Are you sure you want to delete this clipboard item? This action cannot be undone.';
        
        // Set up confirm button action
        modalConfirmBtn.onclick = () => {
            deleteClipboardItem(id);
            closeModal();
        };
        
        openModal();
    } else {
        // No content, delete without confirmation
        deleteClipboardItem(id);
    }
}

// Delete clipboard item from Firestore
function deleteClipboardItem(id) {
    showLoading();
    
    deleteDoc(doc(db, 'clipboardItems', id))
        .then(() => {
            hideLoading();
            // No need to manually update UI as Firestore listener will handle it
        })
        .catch(error => {
            console.error("Error deleting clipboard item: ", error);
            showToast('Error deleting clipboard item');
            hideLoading();
        });
}

// Handle updating clipboard item content
function handleUpdateItem(event) {
    const { id, content } = event.detail;
    
    updateDoc(doc(db, 'clipboardItems', id), {
        content: content,
        updatedAt: new Date()
    })
    .catch(error => {
        console.error("Error updating clipboard item: ", error);
        showToast('Error saving clipboard item');
    });
}

// Handle user logout
function handleLogout() {
    showLoading();
    
    // Clear the sync interval before logging out
    clearSyncInterval();
    
    signOut(auth)
        .then(() => {
            // Redirect handled by auth state listener
        })
        .catch((error) => {
            console.error("Error signing out: ", error);
            showToast('Error signing out');
            hideLoading();
        });
}

// Show toast notification
function showToast(message, duration = 3000) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// Open confirmation modal
function openModal() {
    modal.classList.add('open');
}

// Close confirmation modal
function closeModal() {
    modal.classList.remove('open');
}

// Show loading overlay
function showLoading() {
    loadingOverlay.classList.add('show');
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.classList.remove('show');
}

// Debounce function for limiting rate of function calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);