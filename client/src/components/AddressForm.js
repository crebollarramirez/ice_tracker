"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { MapPin, Upload, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useDonate } from "@/contexts/DonateContext";
import { pinFunction, storage, auth, database } from "../firebase";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { ref as dbRef, push } from "firebase/database";
import { signInAnonymously } from "firebase/auth";
import { cn } from "@/utils/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const reportFormSchema = z.object({
  address: z
    .string()
    .trim()
    .min(1, { message: "Address is required" })
    .max(200, { message: "Address must be less than 200 characters" }),
  additionalInfo: z
    .string()
    .trim()
    .min(1, { message: "Additional information is required" })
    .max(1000, {
      message: "Additional information must be less than 1000 characters",
    }),
  image: z
    .any()
    .refine((files) => files?.length === 1, "Image is required")
    .refine(
      (files) => files?.[0]?.size <= MAX_FILE_SIZE,
      "Max file size is 5MB"
    )
    .refine(
      (files) => ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      "Only .jpg, .jpeg, .png and .webp formats are supported"
    ),
});

export default function AddressForm({ className }) {
  const [imagePreview, setImagePreview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const { toast } = useToast();
  const { showDonatePopup } = useDonate();

  const form = useForm({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      address: "",
      additionalInfo: "",
    },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setSubmitStatus("Preparing...");
    let uploadedStoragePath = null;

    try {
      // Ensure user is authenticated (anonymous is fine)
      let currentUser = auth.currentUser;
      if (!currentUser) {
        console.log("No user found, signing in anonymously...");
        const userCredential = await signInAnonymously(auth);
        currentUser = userCredential.user;
      }

      const uid = currentUser.uid;
      const imageFile = data.image[0];

      // Generate unique report ID using Firebase RTDB push key
      const reportId = push(dbRef(database, "reports/pending")).key;

      // Determine file extension
      const fileExtension = imageFile.type === "image/png" ? "png" : "jpg";
      const storagePath = `reports/pending/${uid}/${reportId}.${fileExtension}`;
      setSubmitStatus("Uploading image...");

      // Upload image to Firebase Storage
      const imageRef = storageRef(storage, storagePath);
      await uploadBytes(imageRef, imageFile);
      uploadedStoragePath = storagePath;
      setSubmitStatus("Processing...");

      // Get download URL
      const imageUrl = await getDownloadURL(imageRef);
      setSubmitStatus("Submitting...");

      // Call Firebase function with image URL
      const result = await pinFunction({
        addedAt: new Date().toISOString(),
        address: data.address.trim(),
        additionalInfo: data.additionalInfo.trim(),
        imageUrl: imageUrl,
        imagePath: storagePath,
      });

      console.log("Pin function result:", result);

      toast({
        title: "Report submitted successfully",
        description: "Thank you for helping keep the community informed.",
      });

      // Show donate popup after successful submission
      showDonatePopup();

      // Reset form
      form.reset();
      setImagePreview("");
      uploadedStoragePath = null; // Mark as successful so we don't delete
    } catch (error) {
      console.error("Error submitting report:", error);

      // If we uploaded a file but pin failed, optionally delete it to avoid orphans
      if (uploadedStoragePath) {
        try {
          const orphanRef = storageRef(storage, uploadedStoragePath);
          await deleteObject(orphanRef);
          console.log("Cleaned up orphaned image:", uploadedStoragePath);
        } catch (deleteError) {
          console.error("Failed to clean up orphaned image:", deleteError);
        }
      }

      let errorMessage = "Please try again later.";

      // Handle upload errors
      if (error.code?.startsWith("storage/")) {
        switch (error.code) {
          case "storage/unauthorized":
            errorMessage =
              "You don't have permission to upload images. Please refresh and try again.";
            break;
          case "storage/canceled":
            errorMessage = "Upload was canceled.";
            break;
          case "storage/unknown":
            errorMessage = "An unknown error occurred during upload.";
            break;
          default:
            errorMessage = `Upload failed: ${error.message}`;
        }
      }
      // Handle function errors
      else if (error.code?.startsWith("functions/")) {
        switch (error.code) {
          case "functions/invalid-argument":
            errorMessage =
              error.message ||
              "Please provide a valid address that can be found on the map";
            break;
          case "functions/failed-precondition":
            errorMessage =
              error.message ||
              "Please avoid using negative or abusive language.";
            break;
          case "functions/not-found":
            errorMessage =
              error.message ||
              "Please provide a valid address that can be found on the map";
            break;
          case "functions/internal":
            errorMessage =
              error.message || "An error occurred while submitting the form";
            break;
          default:
            errorMessage =
              error.message || "An error occurred while submitting the form";
        }
      }
      // Handle auth errors
      else if (error.code?.startsWith("auth/")) {
        errorMessage = "Authentication failed. Please refresh and try again.";
      }

      toast({
        title: "Submission failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setSubmitStatus("");
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.onerror = () => {
        console.error("Error reading file");
        setImagePreview("");
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview("");
    }
  };

  return (
    <Card className={cn("border-primary/30", className)}>
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-6 h-6 text-primary" />
          <CardTitle className="text-2xl">Submit a Report</CardTitle>
        </div>
        <CardDescription className="text-base">
          Help your community by reporting ICE activity in your area
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Address Field */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter exact location (intersection, address, or landmark)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Additional Info Field */}
            <FormField
              control={form.control}
              name="additionalInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Information *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what you observed (vehicles, checkpoints, detainments, etc.)"
                      className="min-h-[120px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Image Upload Field */}
            <FormField
              control={form.control}
              name="image"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormLabel>Photo Evidence *</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Input
                          type="file"
                          accept={ACCEPTED_IMAGE_TYPES.join(",")}
                          onChange={(e) => {
                            onChange(e.target.files);
                            handleImageChange(e);
                          }}
                          {...field}
                          className="cursor-pointer"
                        />
                      </div>

                      {imagePreview && (
                        <div className="relative w-full max-w-md">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-auto rounded-lg border border-border"
                          />
                        </div>
                      )}

                      {!imagePreview && (
                        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                          <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Upload a photo (JPG, PNG, or WebP - Max 5MB)
                          </p>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Privacy Notice */}
            <div className="flex gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                All reports are completely anonymous. Your personal information
                will not be shared.
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {submitStatus}
                </>
              ) : (
                "Submit Report"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
