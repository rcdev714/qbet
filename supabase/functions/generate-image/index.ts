// @ts-nocheck: Deno edge runtime uses remote imports
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    console.log("Generating image for prompt:", prompt);

    // Call Gemini API for Imagen 3
    const requestBody = {
      instances: [
        {
          prompt: prompt,
        },
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: "9:16",
        outputOptions: {
          mimeType: "image/jpeg",
        },
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      throw new Error(`Failed to generate image: ${response.statusText}`);
    }

    const data = await response.json();
    const predictions = data?.predictions;
    if (!predictions || predictions.length === 0) {
      throw new Error("No image data returned from API");
    }

    const base64Image = predictions[0]?.bytesBase64Encoded;

    if (!base64Image) {
      throw new Error("No image data found in prediction");
    }

    // Initialize Supabase Client to upload image directly
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const fileName = `generated/${crypto.randomUUID()}.jpg`;

    // Convert base64 to Uint8Array using Deno std lib
    const imageBytes = decode(base64Image);

    console.log("Uploading to Storage...");
    const { error: uploadError } = await supabaseClient.storage
      .from("market-images")
      .upload(fileName, imageBytes, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseClient.storage
      .from("market-images")
      .getPublicUrl(fileName);

    console.log("Success! Image URL:", publicUrl);

    return new Response(JSON.stringify({ imageUrl: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error generating image:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
