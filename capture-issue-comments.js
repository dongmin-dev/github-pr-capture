// capture-issue-comments.js
// GitHub Issue 페이지에서 Issue 설명 + 코멘트 전체를
// "라이트 테마 + 코멘트 헤더/본문만 배경, 바깥은 투명" 한 장 PNG로 저장합니다.

import puppeteer from "puppeteer";

const DEFAULT_ISSUE_URL = "https://github.com/eagle4bros/lookback/issues/1";
const VIEWPORT = { width: 1200, height: 800 };
const MAX_VIEWPORT_HEIGHT = 8000;
// GitHub Issue 페이지의 메인 콘텐츠 영역 셀렉터
const MAIN_CONTENT_SELECTOR = ".Layout-main, main[id='js-repo-pjax-container'], [data-turbo-body]";
const SCREENSHOT_PATH = "issue-comments.png";

const CUSTOM_CSS = `
  /* 전체 배경을 투명으로 */
  html, body {
    background-color: transparent !important;
  }

  [class*="IssueViewer-module"] {
    background-color: transparent !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  .kGvEaV {
    display: none !important;
  }

  .prc-Timeline-TimelineItem-Sd-t-:before {
    display: none !important;
  }

  [class*="IssueBodyViewer-module"],
  [class*="IssueCommentViewer-module"],
  [class*="IssueCommentContent-module"] {
    background-color: #ffffff !important;
    border-radius: 6px !important;
  }

  /* 코멘트 박스에 테두리만 확실하게 추가 (배경은 기본 흰색 유지) */
  #issue-body-viewer {
    border-radius: 6px !important;
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
  .discussion-timeline-actions,
  #repository-container-header,
  [class*="SignedOutBanner-module"] {
    display: none !important;
  }

  /* 코멘트 헤더 줄(예: "dongmin-dev commented on Oct 19") 배경만 살짝 회색으로 */
  .timeline-comment-header,
  [class*="ActivityHeader-module"],
  [class*="IssueBodyHeader-module"] {
    background-color: #f6f8fa !important;  /* GitHub 라이트 헤더색 */
  }
  
  .TimelineItem-break {
    background-color: transparent !important;
  }

  .inserted-circle {
    width: 28px;
    height: 28px;
    background-color: rgb(246, 248, 250);
    border-radius: 50%;
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
  }
`;

const getIssueUrl = () => process.argv[2] || DEFAULT_ISSUE_URL;

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
  // main 태그가 로드될 때까지 기다림
  await page.waitForSelector("main", { timeout: 10000 });
  // 콘텐츠가 완전히 로드될 때까지 추가 대기
  await new Promise(resolve => setTimeout(resolve, 1000));
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

const insertCircles = async (page) => {
  await page.evaluate(() => {
    const svgs = document.querySelectorAll("svg.octicon-person");
    svgs.forEach((svg) => {
      const parent = svg.parentNode;
      if (!parent) return;

      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.position === "static") {
        parent.style.position = "relative";
      }

      // svg를 원보다 앞으로
      svg.style.position = "relative";
      svg.style.zIndex = "2";

      const circle = document.createElement("div");
      circle.className = "inserted-circle";

      // svg 중심에 원 배치
      // svg.getBBox()는 SVG 내부 좌표라 안 맞을 수 있음. getBoundingClientRect() 사용.
      // 하지만 offsetLeft/Top을 써야 relative 부모 기준 좌표가 나옴.
      // svg가 inline이면 offsetWidth/Height가 0일 수도 있으니 getBoundingClientRect 활용.
      const rect = svg.getBoundingClientRect();
      
      // offsetLeft/Top 사용이 안전 (부모 기준)
      const left = svg.offsetLeft + rect.width / 2 - 14; // 14 = 28/2
      const top = svg.offsetTop + rect.height / 2 - 14;

      circle.style.left = `${left}px`;
      circle.style.top = `${top}px`;

      parent.insertBefore(circle, svg);
    });
  });
};

const findMainContentRoot = async (page) =>
  (await page.$("main")) || 
  (await page.$(".Layout-main")) || 
  (await page.$("[data-turbo-body]"));

const captureDiscussionScreenshot = async (page, root, paddingBottom = 50) => {
  let box = await root.boundingBox();

  if (!box) {
    throw new Error("boundingBox 를 얻지 못했습니다.");
  }

  // Issue 타이틀 영역(.gh-header-show)이 있으면 영역에 포함시킵니다.
  const issueHeader = await page.$(".gh-header-show, [class*='IssueHeader-module']");
  if (issueHeader) {
    const headerBox = await issueHeader.boundingBox();
    if (headerBox) {
      const newY = Math.min(box.y, headerBox.y);
      const newHeight = (box.y + box.height) - newY;
      const newX = Math.min(box.x, headerBox.x);
      const newWidth = Math.max(box.x + box.width, headerBox.x + headerBox.width) - newX;
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
  const issueUrl = getIssueUrl();
  const { browser, page } = await launchBrowser();

  try {
    console.log(`Opening ${issueUrl}`);
    await page.goto(issueUrl, { waitUntil: "networkidle0" });

    await forceLightTheme(page);
    // sleep 제거하고 명시적인 대기 사용
    await waitForContent(page);
    await adjustViewportToContent(page);
    await injectCaptureStyles(page);
    await insertCircles(page);

    const root = await findMainContentRoot(page);

    if (!root) {
      throw new Error("메인 콘텐츠 영역을 찾지 못했습니다.");
    }

    await captureDiscussionScreenshot(page, root);
    console.log(`Saved ${SCREENSHOT_PATH}`);
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  console.error(`[capture-issue-comments] ${error.message}`);
  process.exitCode = 1;
});
