import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFireworksApiKey } from "@/lib/ai/config";

export interface ParsedReceiptData {
  vendor: string | null;
  amount: number | null;
  date: string | null; // YYYY-MM-DD
  description: string | null;
  lineItems: Array<{ description: string; amount: number }>;
  confidence: number; // 0-1
}

interface FireworksMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }>;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { imageUrl, imageBase64 } = body;

    if (!imageUrl && !imageBase64) {
      return NextResponse.json(
        { error: "Either imageUrl or imageBase64 is required" },
        { status: 400 }
      );
    }

    const fireworksKey = getFireworksApiKey();
    if (!fireworksKey) {
      console.error("Fireworks key not configured");
      return NextResponse.json(
        { error: "Receipt parsing not configured" },
        { status: 500 }
      );
    }

    // Build the image content for the API
    let imageContent: string;
    if (imageBase64) {
      // If base64 is provided, use it directly
      imageContent = imageBase64.startsWith("data:")
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;
    } else {
      // Use the URL directly
      imageContent = imageUrl;
    }

    const systemPrompt = `You are a receipt parsing assistant. Analyze the receipt image and extract the following information:
- vendor: The name of the store, restaurant, or business
- amount: The total amount paid (as a number, without currency symbols)
- date: The transaction date in YYYY-MM-DD format
- description: A brief description of what was purchased
- lineItems: Individual items on the receipt with their amounts

Return your response as a JSON object with this exact structure:
{
  "vendor": "string or null",
  "amount": number or null,
  "date": "YYYY-MM-DD string or null",
  "description": "string or null",
  "lineItems": [{"description": "string", "amount": number}],
  "confidence": number between 0 and 1
}

If you cannot extract a field, use null. The confidence score should reflect how certain you are about the extracted data (1.0 = very confident, 0.0 = completely uncertain).
For dates, convert any format to YYYY-MM-DD. For amounts, extract just the number without currency symbols.
Return ONLY the JSON object, no other text.`;

    const messages: FireworksMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Please analyze this receipt and extract the purchase details.",
          },
          {
            type: "image_url",
            image_url: { url: imageContent },
          },
        ],
      },
    ];

    const response = await fetch(
      "https://api.fireworks.ai/inference/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${fireworksKey}`,
        },
        body: JSON.stringify({
          model: "accounts/fireworks/models/kimi-k2p5",
          messages,
          max_tokens: 1000,
          temperature: 0.1, // Low temperature for consistent extraction
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Fireworks API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to parse receipt" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in Fireworks response:", data);
      return NextResponse.json(
        { error: "No response from Wrapshot Intelligence" },
        { status: 500 }
      );
    }

    // Parse the JSON response
    let parsedData: ParsedReceiptData;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      parsedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse Wrapshot Intelligence response:", content, parseError);
      // Return partial data with low confidence
      parsedData = {
        vendor: null,
        amount: null,
        date: null,
        description: null,
        lineItems: [],
        confidence: 0.1,
      };
    }

    // Validate and normalize the data
    const result: ParsedReceiptData = {
      vendor: typeof parsedData.vendor === "string" ? parsedData.vendor.trim() : null,
      amount: typeof parsedData.amount === "number" ? parsedData.amount : null,
      date: isValidDate(parsedData.date) ? parsedData.date : null,
      description: typeof parsedData.description === "string" ? parsedData.description.trim() : null,
      lineItems: Array.isArray(parsedData.lineItems)
        ? parsedData.lineItems
            .filter((item) => item && typeof item.description === "string" && typeof item.amount === "number")
            .map((item) => ({
              description: item.description.trim(),
              amount: item.amount,
            }))
        : [],
      confidence: typeof parsedData.confidence === "number"
        ? Math.max(0, Math.min(1, parsedData.confidence))
        : 0.5,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error parsing receipt:", error);
    return NextResponse.json(
      { error: "Failed to parse receipt" },
      { status: 500 }
    );
  }
}

function isValidDate(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== "string") return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}
