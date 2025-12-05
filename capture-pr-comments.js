// capture-pr-comments.js
// GitHub PR 페이지에서 PR 설명 + 코멘트 전체를
// "라이트 테마 + 코멘트 헤더/본문만 배경, 바깥은 투명" 한 장 PNG로 저장합니다.

import puppeteer from "puppeteer";

const DEFAULT_PR_URL = "https://github.com/srini-abhiram/Glances-Go/pull/32";
const VIEWPORT = { width: 1200, height: 800 };
const MAX_VIEWPORT_HEIGHT = 8000;
const DISCUSSION_SELECTOR = "#discussion_bucket, .js-discussion";
const SCREENSHOT_PATH = "pr-comments.png";

const CUSTOM_CSS = `
  /* 전체 배경을 투명으로 */
  html, body {
    background: transparent !important;
  }

  /* 바깥 큰 컨테이너들만 투명하게 (카드 내부는 건드리지 않음) */
  body,
  .application-main,
  .Layout,
  .Layout-main,
  #discussion_bucket,
  .js-discussion {
    background-color: transparent !important;
  }

  /* 헤더/푸터/사이드바는 숨김 */
  header,
  .Header,
  .Footer,
  .footer,
  .gh-header,
  .gh-header-sticky,
  .flash,
  .discussion-sidebar,
  .Layout-sidebar,
  .discussion-timeline-actions {
    display: none !important;
  }

  /* 코멘트 카드의 그림자만 제거 (레이아웃/간격은 그대로) */
  .TimelineItem,
  .timeline-comment-group,
  .js-comment-container {
    box-shadow: none !important;
  }

  .blob-wrapper.border-bottom,
  .js-comments-holder,
  js-inline-comments-container {
    background-color: #ffffff !important;
  }

  /* 코멘트 헤더 줄(예: "dongmin-dev commented on Oct 19") 배경만 살짝 회색으로 */
  .timeline-comment-header {
    background-color: #f6f8fa !important;  /* GitHub 라이트 헤더색 */
  }

  /* 코멘트 박스에 테두리만 확실하게 추가 (배경은 기본 흰색 유지) */
  .timeline-comment,
  .js-comment-container .review-comment,
  .review-comment {
    border: 1px solid #d0d7de !important;  /* GitHub 기본 테두리색 */
  }
  
  .TimelineItem-break {
    background-color: transparent !important;
  }

  /* [수정됨] 상단 탭(Conversation)의 흰색 배경만 투명화하고, 테두리는 유지 */
  .tabnav-tab.selected {
    background-color: transparent !important; 
    /* border-color 설정을 삭제하여 원래의 선택된 테두리가 보이도록 함 */
  }
`;

const getPrUrl = () => process.argv[2] || DEFAULT_PR_URL;

const launchBrowser = async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: VIEWPORT,
  });

  const page = await browser.newPage();
  return { browser, page };
};

const forceLightTheme = async (page) => {
  await page.evaluate(() => {
    const html = document.documentElement;
    html.setAttribute("data-color-mode", "light");
    html.setAttribute("data-light-theme", "light");
    html.removeAttribute("data-dark-theme");
  });
};

const waitForContent = async (page) => {
  // discussion 영역과 코멘트가 로드될 때까지 기다림
  await Promise.all([
    page.waitForSelector(DISCUSSION_SELECTOR, { timeout: 10000 }),
    page.waitForSelector(".timeline-comment", { timeout: 10000 }),
  ]);
};

const adjustViewportToContent = async (page) => {
  const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewport({
    width: VIEWPORT.width,
    height: Math.min(bodyHeight, MAX_VIEWPORT_HEIGHT),
  });
  // 뷰포트 조정 후 스크롤을 맨 위로 초기화
  await page.evaluate(() => window.scrollTo(0, 0));
};

const injectCaptureStyles = (page) => page.addStyleTag({ content: CUSTOM_CSS });

const findDiscussionRoot = async (page) =>
  (await page.$("#discussion_bucket")) || (await page.$(".js-discussion"));

const captureDiscussionScreenshot = async (page, root, paddingBottom = 50) => {
  let box = await root.boundingBox();

  if (!box) {
    throw new Error("boundingBox 를 얻지 못했습니다.");
  }

  // 상단 탭(.tabnav)이 있으면 영역에 포함시킵니다.
  const tabnav = await page.$(".tabnav");
  if (tabnav) {
    const tabBox = await tabnav.boundingBox();
    if (tabBox) {
      // 탭의 상단(y)부터 discussion의 하단까지 포함하도록 영역 확장
      const newY = Math.min(box.y, tabBox.y);
      const newHeight = (box.y + box.height) - newY;
      
      // x축과 너비도 두 영역을 모두 포함하도록 조정
      const newX = Math.min(box.x, tabBox.x);
      const newWidth = Math.max(box.x + box.width, tabBox.x + tabBox.width) - newX;

      box = { x: newX, y: newY, width: newWidth, height: newHeight };
    }
  }

  await page.screenshot({
    path: SCREENSHOT_PATH,
    clip: {
      x: Math.floor(box.x),
      y: Math.floor(box.y),
      width: Math.ceil(box.width),
      height: Math.ceil(box.height) + paddingBottom,
    },
    omitBackground: true,
  });
};

const run = async () => {
  const prUrl = getPrUrl();
  const { browser, page } = await launchBrowser();

  try {
    console.log(`Opening ${prUrl}`);
    await page.goto(prUrl, { waitUntil: "networkidle0" });

    await forceLightTheme(page);
    // sleep 제거하고 명시적인 대기 사용
    await waitForContent(page);
    await adjustViewportToContent(page);
    await injectCaptureStyles(page);

    const root = await findDiscussionRoot(page);

    if (!root) {
      throw new Error("discussion 영역을 찾지 못했습니다.");
    }

    await captureDiscussionScreenshot(page, root);
    console.log(`Saved ${SCREENSHOT_PATH}`);
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  console.error(`[capture-comments] ${error.message}`);
  process.exitCode = 1;
});
