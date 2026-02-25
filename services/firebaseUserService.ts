import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';

const USERS_COLLECTION = 'users';

// Fetch all users
export const fetchUsers = async (): Promise<User[]> => {
  const snapshot = await getDocs(collection(db, USERS_COLLECTION));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as User));
};

// Add a new user
export const addUser = async (userData: Omit<User, 'id'>): Promise<string> => {
  // Map internal managerId to Firestore direct_manager_uid if needed, 
  // or keep consistent. Here we assume the DB uses the same structure or we transform it.
  const docRef = await addDoc(collection(db, USERS_COLLECTION), {
    ...userData,
    direct_manager_uid: userData.managerId // Explicit mapping as requested
  });
  return docRef.id;
};

// Update a user
export const updateUser = async (userId: string, updates: Partial<User>): Promise<void> => {
  const userRef = doc(db, USERS_COLLECTION, userId);
  const { managerId, ...rest } = updates;
  
  const payload: any = { ...rest };
  if (managerId !== undefined) {
    payload.direct_manager_uid = managerId;
    payload.managerId = managerId;
  }
  
  await updateDoc(userRef, payload);
};

// Delete a user
export const deleteUser = async (userId: string): Promise<void> => {
  await deleteDoc(doc(db, USERS_COLLECTION, userId));
};