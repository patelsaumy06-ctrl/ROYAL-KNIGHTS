import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

export const loginUser    = (email, password) => 
  signInWithEmailAndPassword(auth, email, password);

export const registerUser = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

export const loginAnonymously = () =>
  signInAnonymously(auth);

export const logoutUser   = () => signOut(auth);

export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);