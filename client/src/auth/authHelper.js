import {
  signInWithEmailAndPassword,
  getMultiFactorResolver,
  RecaptchaVerifier,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
} from "firebase/auth";

import { auth } from "../firebase";

export async function signInWithEmailPasswordAndMfa(
  email,
  password,
  phoneCodeGetter
) {
  try {
    // First try normal sign-in
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (error) {
    // If MFA is required, Firebase throws this specific error
    if (error.code !== "auth/multi-factor-auth-required") throw error;

    const resolver = getMultiFactorResolver(auth, error);
    const hint = resolver.hints[0]; // assuming one phone enrolled

    // reCAPTCHA
    const recaptcha = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
    });
    const phoneProvider = new PhoneAuthProvider(auth);

    // Send the SMS code
    const verificationId = await phoneProvider.verifyPhoneNumber(
      { multiFactorHint: hint, session: resolver.session },
      recaptcha
    );

    const code = await phoneCodeGetter();
    const cred = PhoneAuthProvider.credential(verificationId, code);
    const assertion = PhoneMultiFactorGenerator.assertion(cred);

    // Complete MFA sign-in
    const mfaCred = await resolver.resolveSignIn(assertion);
    return mfaCred.user;
  }
}
