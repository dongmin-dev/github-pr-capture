// capture-pr-comments-with-merge.js
// 1. 상단 탭 + 간격 확보 + 본문 캡처
// 2. 로그인 세션 유지
// 3. Merge 박스 흰색, 배경 투명

import puppeteer from "puppeteer";
import fs from "fs";

const CONFIG = {
  defaultPrUrl: "https://github.com/srini-abhiram/Glances-Go/pull/40",
  viewport: { width: 1200, height: 800 },
  maxViewportHeight: 10000,
  screenshotPath: "pr-comments-with-merge.png",
  userDataDir: "./user_data",
  navigationOptions: { waitUntil: "networkidle2" },
  discussionSelector: "#discussion_bucket",
  fallbackDiscussionSelector: ".js-discussion",
  tabSelector: ".tabnav",
  paddingBottom: 20,
  waitForSelectorTimeout: 15000,
  homeUrl: "https://github.com",
  loginUrl: "https://github.com/login",
  preThemeDelay: 2000,
  postStyleDelay: 1000,
};

const CUSTOM_CSS = `
  /* [공통] 배경 투명화 */
  html, body { background: transparent !important; }
  body, .application-main, .Layout, .Layout-main,
  #repo-content-pjax-container, #discussion_bucket, .js-discussion,
  .gh-header, .tabnav {
    background-color: transparent !important;
  }

  /* [숨김] 최상단 블랙 헤더, 사이드바, 푸터 */
  header, .Header, .Footer, .footer, .pagehead, 
  .flash, .discussion-sidebar, .Layout-sidebar {
    display: none !important;
  }

  /* PR 제목과 메타 정보 숨김 */
  .gh-header-title, 
  .gh-header-meta,
  .gh-header-sticky { 
    display: none !important; 
  }

  /* [핵심 수정] 탭 스타일 및 하단 여백 추가 */
  .tabnav {
    /* 0 이었던 값을 24px로 늘려 간격 확보 */
    margin-bottom: 24px !important; 
    border-bottom: 1px solid #d0d7de !important;
  }
  
  .tabnav-tab {
    background-color: transparent !important;
  }
  
  /* 선택된 탭 스타일 */
  .tabnav-tab.selected {
    background-color: transparent !important;
    border-color: #d0d7de !important;
    border-bottom-color: transparent !important;
    z-index: 99 !important;
  }

  .MergeBoxSectionHeader-module__wrapper--zMA1Y.MergeBoxSectionHeader-module__wrapperCanExpand--AoekL {
    background-color: #ffffff !important;
    border-top-left-radius: 6px !important;
    border-top-right-radius: 6px !important;
  }

  .MergeBoxSectionHeader-module__wrapper--zMA1Y.flex-column.flex-sm-row.flex-items-center.flex-sm-items-start.flex-justify-between {
    background-color: #ffffff !important;
  }
  
  /* [하단 제거] 입력창 및 안내 문구 숨김 */
  #issue-comment-box,
  .js-new-comment-form,
  .discussion-timeline-actions > .timeline-comment-wrapper,
  .discussion-timeline-actions > form,
  .ProTip,
  p.text-small {
    display: none !important;
  }
  
  /* Merge 박스 컨테이너는 보이게 유지하되, 위쪽 간격 조금 확보 */
  .discussion-timeline-actions {
    display: block !important;
    background: transparent !important;
    border-top: 2px solid rgb(209, 217, 224) !important;
    border-bottom: none !important;
    border-left: none !important;
    border-right: none !important;
    margin-top: 0 !important;
  }

  /* [코멘트 스타일] */
  .TimelineItem, .timeline-comment-group, .js-comment-container {
    box-shadow: none !important;
  }
  .timeline-comment-header {
    background-color: #f6f8fa !important;
  }
  .timeline-comment, .js-comment-container .review-comment, .review-comment {
    border: 1px solid #d0d7de !important;
  }
  .TimelineItem-break { background-color: transparent !important; }
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getPrUrl = () => process.argv[2] || CONFIG.defaultPrUrl;

const ensureUserDataDir = () => {
  if (!fs.existsSync(CONFIG.userDataDir)) {
    fs.mkdirSync(CONFIG.userDataDir);
  }
};

const launchBrowser = async () => {
  ensureUserDataDir();

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
    userDataDir: CONFIG.userDataDir,
  });

  const page = await browser.newPage();
  await page.setViewport(CONFIG.viewport);
  return { browser, page };
};

const isLoggedIn = (page) =>
  page.evaluate(() => document.body.classList.contains("logged-in"));

const performLogin = async (page) => {
  if (await isLoggedIn(page)) {
    console.log("✅ 로그인 세션 유지 중");
    return;
  }

  console.log("🔹 로그인 페이지로 이동합니다...");
  await page.goto(CONFIG.loginUrl, CONFIG.navigationOptions);
  console.log("❗ 브라우저에서 로그인을 완료해주세요.");

  try {
    await page.waitForSelector("body.logged-in", { timeout: 0 });
    console.log("✅ 로그인 성공!");
  } catch (e) {
    console.log("로그인 실패");
    throw e;
  }
};

const forceLightTheme = async (page) => {
  await page.evaluate(() => {
    const html = document.documentElement;
    html.setAttribute("data-color-mode", "light");
    html.setAttribute("data-light-theme", "light");
    html.removeAttribute("data-dark-theme");
  });
};

const waitForDiscussionArea = async (page) => {
  try {
    await page.waitForSelector(CONFIG.discussionSelector, {
      timeout: CONFIG.waitForSelectorTimeout,
    });
  } catch (error) {
    await page.waitForSelector(CONFIG.fallbackDiscussionSelector, {
      timeout: CONFIG.waitForSelectorTimeout,
    });
  }
};

const adjustViewportToContent = async (page) => {
  const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewport({
    width: CONFIG.viewport.width,
    height: Math.min(bodyHeight, CONFIG.maxViewportHeight),
  });
};

const injectCaptureStyles = (page) => page.addStyleTag({ content: CUSTOM_CSS });

const getDiscussionHandle = async (page) =>
  (await page.$(CONFIG.discussionSelector)) ||
  (await page.$(CONFIG.fallbackDiscussionSelector));

const captureCombinedArea = async (page) => {
  const tabNav = await page.$(CONFIG.tabSelector);
  const discussion = await getDiscussionHandle(page);

  if (!discussion) throw new Error("Discussion area not found");

  const discussionBox = await discussion.boundingBox();

  if (!discussionBox) {
    throw new Error("Unable to determine discussion bounding box");
  }

  let finalBox = { ...discussionBox };

  if (tabNav) {
    const tabBox = await tabNav.boundingBox();
    if (tabBox) {
      const bottomY = finalBox.y + finalBox.height;
      finalBox.y = tabBox.y;
      finalBox.height = bottomY - tabBox.y;
      finalBox.width = Math.max(finalBox.width, tabBox.width);
      finalBox.x = Math.min(finalBox.x, tabBox.x);
    }
  }

  await page.screenshot({
    path: CONFIG.screenshotPath,
    clip: {
      x: Math.floor(finalBox.x),
      y: Math.floor(finalBox.y),
      width: Math.ceil(finalBox.width),
      height: Math.ceil(finalBox.height) + CONFIG.paddingBottom,
    },
    omitBackground: true,
  });
};

const preparePageForCapture = async (page, prUrl) => {
  console.log(`🚀 Opening PR page: ${prUrl}`);
  await page.goto(prUrl, CONFIG.navigationOptions);

  await forceLightTheme(page);
  await sleep(CONFIG.preThemeDelay);

  await waitForDiscussionArea(page);
  await injectCaptureStyles(page);

  await sleep(CONFIG.postStyleDelay);
  await adjustViewportToContent(page);
};

const run = async () => {
  const prUrl = getPrUrl();
  const { browser, page } = await launchBrowser();

  try {
    await page.goto(CONFIG.homeUrl, CONFIG.navigationOptions);
    await performLogin(page);
    await preparePageForCapture(page, prUrl);
    await captureCombinedArea(page);
    console.log(`✨ Saved ${CONFIG.screenshotPath}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
