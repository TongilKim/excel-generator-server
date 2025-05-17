# Excel Generator for Figma

A powerful Figma plugin that allows you to generate Excel files directly from your Figma designs. This plugin helps you export design data in a structured Excel format, making it easier to manage and share design specifications.

## Features

- **Multiple Data Sections**: Upload and process three different types of Excel data:
  - List Data
  - List Detail Data
  - Product Detail Data
- **Real-time Processing**: Instant feedback on file upload status
- **User-friendly Interface**: Simple and intuitive UI for file management
- **Progress Tracking**: Visual indicators for upload and processing status
- **Error Handling**: Clear error messages and status updates

## Installation

1. Open Figma
2. Go to Plugins > Browse plugins in community
3. Search for "Excel Generator"
4. Click "Install"

## Usage

1. Open your Figma design
2. Go to Plugins > Excel Generator
3. In the plugin interface, you'll see three sections:
   - Section 1: List Data
   - Section 2: List Detail Data
   - Section 3: Product Detail Data
4. For each section:
   - Click "Choose File" to select your Excel file
   - Wait for the upload to complete
   - You'll see a success message when the data is processed
5. The plugin will automatically process your data and make it available in your Figma design

## Supported File Formats

- `.xlsx` (Excel 2007+)
- `.xls` (Excel 97-2003)

## Requirements

- Figma Desktop App or Figma Web
- Excel files in the supported formats
- Internet connection for file processing

## Privacy & Security

This plugin:

- Only processes the Excel files you explicitly upload
- Does not store any of your data permanently
- Requires internet access for file processing
- Does not share your data with any third parties

## Support

If you encounter any issues or have questions:

1. Check the error messages in the plugin interface
2. Ensure your Excel files are in the correct format
3. Verify your internet connection
4. Contact support through the Figma plugin page

## Version History

- v1.0.0: Initial release
  - Basic Excel file processing
  - Three-section data management
  - Real-time status updates

## License

This plugin is free to use and is licensed under the MIT License.

---

Made with ❤️ for the Figma community

# Figma Image Proxy Server

이 프로젝트는 Figma 플러그인에서 이미지를 안정적으로 가져오기 위한 프록시 서버를 포함합니다.

## 주요 기능

- CORS 문제 해결
- 이미지 캐싱 (1주일)
- 요청 속도 제한 (IP당 분당 최대 15건)
- 이미지 요청 안정성 향상

## 프록시 서버 배포하기

### 로컬에서 테스트

1. 필요한 패키지 설치:

   ```bash
   npm install
   ```

2. 로컬 서버 실행:

   ```bash
   npm run dev
   ```

3. 브라우저에서 `http://localhost:3000` 접속하여 테스트

### Vercel에 배포하기

1. [Vercel](https://vercel.com) 계정에 로그인 또는 가입

2. Vercel CLI 설치:

   ```bash
   npm install -g vercel
   ```

3. 프로젝트 폴더에서 Vercel에 로그인:

   ```bash
   vercel login
   ```

4. 배포 진행:

   ```bash
   vercel
   ```

5. 배포 완료 후 도메인 확인 (예: `your-project.vercel.app`)

## Figma 플러그인에 연동하기

1. `src/figma/constants.ts` 파일에서 `CUSTOM_PROXY_URL` 값을 업데이트:

   ```typescript
   export const CUSTOM_PROXY_URL =
     "https://your-project.vercel.app/api/proxy?url=";
   ```

2. Figma 플러그인을 다시 빌드하고 테스트하세요.

## 프록시 서버 동작 방식

1. 이미지 요청이 프록시 서버로 전달됩니다
2. 서버는 이미지가 캐시에 있는지 확인합니다
3. 캐시에 있으면 바로 반환, 없으면 원본 이미지를 가져옵니다
4. 이미지는 캐시에 저장되고 클라이언트로 전송됩니다
5. 요청 속도 제한 적용으로 원본 서버 차단 방지

## 성능 향상 방법

이 프록시 서버를 사용하면 다음과 같이 성능이 향상됩니다:

1. Figma 코드에서 배치 크기를 늘릴 수 있습니다:

   ```typescript
   // src/figma/constants.ts
   export const BATCH_CONFIG = {
     AMOUNT_OF_EACH_BATCH: 10, // 3에서 10으로 증가
     BATCH_DELAY: 3000, // 7000에서 3000으로 감소
     // ...
   };
   ```

2. 캐싱으로 인해 동일한 이미지의 반복 요청이 빨라집니다.

3. 프록시 서버가 요청을 관리하므로, Figma 플러그인에서 더 적극적으로 병렬 요청을 보낼 수 있습니다.

## 문제 해결

- **서버 오류**: Vercel 로그 확인 및 요청 횟수 제한 확인
- **이미지 로드 실패**: 원본 URL 접근 가능 여부 확인
- **속도 제한 오류**: 요청 속도 확인 및 조정

## 보안 고려사항

- 프록시는 artsco202525.speedgabia.com 도메인의 이미지만 허용합니다
- 요청 속도 제한으로 서버 과부하 방지
- 모든 요청은 검증 후 처리됩니다
