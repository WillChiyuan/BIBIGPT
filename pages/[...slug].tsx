import type { NextPage } from "next";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { useLocalStorage } from "react-use";
import { useAnalytics } from "~/components/context/analytics";
import { SubmitButton } from "~/components/SubmitButton";
import { SummaryResult } from "~/components/SummaryResult";
import { SwitchTimestamp } from "~/components/SwitchTimestamp";
import { TypingSlogan } from "~/components/TypingSlogan";
import { UsageAction } from "~/components/UsageAction";
import { UsageDescription } from "~/components/UsageDescription";
import { UserKeyInput } from "~/components/UserKeyInput";
import { useToast } from "~/hooks/use-toast";
import { useSummarize } from "~/hooks/useSummarize";
import { VideoService } from "~/lib/types";
import { extractUrl } from "~/utils/extractUrl";
import { getValidatedUrl } from "~/utils/getValidatedUrl";
import getVideoId from "get-video-id";

export const Home: NextPage = () => {
  const router = useRouter();
  const urlState = router.query.slug;
  const searchParams = useSearchParams();
  const licenseKey = searchParams.get("license_key");

  // TODO: add mobx or state manager
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>("");
  const [shouldShowTimestamp, setShouldShowTimestamp] =
    useLocalStorage<boolean>("should-show-timestamp", false);
  const [currentBvId, setCurrentVideoId] = useState<string>("");
  const [userKey, setUserKey, remove] =
    useLocalStorage<string>("user-openai-apikey");
  const { loading, summary, resetSummary, summarize } = useSummarize();
  const { toast } = useToast();
  const { analytics } = useAnalytics();

  useEffect(() => {
    licenseKey && setUserKey(licenseKey);
  }, [licenseKey]);

  useEffect(() => {
    const validatedUrl = getValidatedUrl(
      router.isReady,
      currentVideoUrl,
      urlState
    );

    validatedUrl && generateSummary(validatedUrl);
  }, [router.isReady, urlState]);

  const validateUrl = (url?: string) => {
    // note: auto refactor by ChatGPT
    const videoUrl = url || currentVideoUrl;
    if (
      !videoUrl.includes("bilibili.com") &&
      !videoUrl.includes("youtube.com")
    ) {
      toast({
        title: "???????????????????????????",
        description: "???????????????????????????????????????????????????b23.tv???av???",
      });
      return;
    }

    if (!url) {
      // -> '/video/BV12Y4y127rj'
      const curUrl = String(videoUrl.split(".com")[1]);
      router.replace(curUrl);
    } else {
      setCurrentVideoUrl(videoUrl);
    }
  };
  const generateSummary = async (url?: string) => {
    resetSummary();
    validateUrl(url);

    const videoUrl = url || currentVideoUrl;
    const { id, service } = getVideoId(videoUrl);
    if (service === "youtube" && id) {
      setCurrentVideoId(id);
      await summarize(
        { videoId: id, service: VideoService.Youtube },
        { userKey, shouldShowTimestamp }
      );
      return;
    }

    const bvId = extractUrl(videoUrl);
    if (!bvId) {
      return;
    }

    setCurrentVideoId(bvId);
    await summarize(
      { videoId: bvId, service: VideoService.Bilibili },
      { userKey, shouldShowTimestamp }
    );
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }, 10);
  };
  const onFormSubmit = async (e: any) => {
    e.preventDefault();
    await generateSummary();
    analytics.track("GenerateButton Clicked");
  };
  const handleApiKeyChange = (e: any) => {
    if (!e.target.value) {
      remove();
    }
    setUserKey(e.target.value);
  };

  function handleShowTimestamp(checked: boolean) {
    console.log("================", checked);
    setShouldShowTimestamp(checked);
    analytics
      .track(`ShowTimestamp Clicked`, {
        bvId: currentBvId,
        shouldShowTimestamp: checked,
      })
      .then((res) => console.log("tracked!", res))
      .catch(console.error);
    // throw new Error("Sentry Frontend Error");
  }

  return (
    <div className="mt-10 w-full sm:mt-40">
      <UsageDescription />
      <TypingSlogan />
      <UsageAction />
      <UserKeyInput value={userKey} onChange={handleApiKeyChange} />
      <form onSubmit={onFormSubmit} className="grid place-items-center">
        <input
          type="text"
          value={currentVideoUrl}
          onChange={(e) => setCurrentVideoUrl(e.target.value)}
          className="mx-auto mt-10 w-full appearance-none rounded-lg rounded-md border bg-transparent py-2 pl-2 text-sm leading-6 text-slate-900 shadow-sm ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={"?????? bilibili.com ?????????????????????????????????"}
        />
        <SubmitButton loading={loading} />
        <SwitchTimestamp
          checked={shouldShowTimestamp}
          onCheckedChange={handleShowTimestamp}
        />
      </form>
      {summary && (
        <SummaryResult
          summary={summary}
          curVideo={currentVideoUrl}
          currentBvId={currentBvId}
        />
      )}
    </div>
  );
};

export default Home;
