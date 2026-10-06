# Forest 横版扩图记录

使用内置 image_gen 工具制作；新增环境为 AI 延展，不是官方原始 CG。最终选用第二版，保留原竖版素材。

## 初版提示词

Use case: precise-object-edit / horizontal outpainting.
Asset type: full-width GitHub profile README banner.
Input image 1 is the exact edit target: the user's approved Forest cover with its Forest / フォレスト title. Transform the portrait cover into a seamless panoramic illustration approximately 2.8:1, ideally 2864 by 1024 pixels.
Place the complete original portrait composition in the middle of the panorama, uniformly scaled to fit the full height. Keep the entire original artwork visible: all five characters with their exact original faces, hair, expressions, poses, clothing, shoes and outlines; the moss-covered tower; the complete clock face and bottom tower; every part of the Forest logo and フォレスト text at the top. Preserve the original central artwork as closely as possible. Do not horizontally stretch, squeeze, crop, rearrange or redesign the characters, clock, or title.
Extend ONLY the landscape into the new space on both sides: a coherent continuation of the original dark mossy woodland, distant town silhouettes, antique architectural textures, and blue-to-pale-yellow-to-warm-orange twilight sky, with a modest continuation of the same white drifting petals. Match the approved artwork's inked anime illustration, slightly textured painted environment, dense green moss, warm brown masonry, and exact color palette. The woodland extensions should have readable depth, not just a solid dark wall; visually balance the centered original group without adding attention-grabbing new objects.
Make it one continuous scene edge to edge, with no obvious seams, no rectangular portrait insert, no duplicated mirrored copy, no tiled repetitions, no blurred filler bands, no white sidebars and no blank copy area. Do not add any new characters, username, slogan, badges, labels, or typography. Keep existing title verbatim: "Forest", "フォレスト". Preserve the small existing copyright attribution. Opaque background. High quality crisp illustration, ready to display at a width of 800–1000 px; the complete central composition should remain clear at that size.

## 完整钟楼修正提示词（最终版）

Use case: precise-object-edit, preserve approved banner except central restoration.
Image 1 is the wide banner edit target. Image 2 is the complete portrait Forest cover, the authoritative source for central details.
Make ONE targeted correction: restore the ENTIRE central portrait artwork from Image 2 into the wide panorama, uniformly scaled to fit inside 94% of the banner's height, with a small 3% top and bottom breathing margin. Preserve Image 1's wide dimensions, woodland and twilight background, original illustrative style, and its surrounding composition. Blend the outer edges of the central source into that landscape without rectangular seams.
The entire central tower must now fit: not only the characters but also the COMPLETE visible clock face and the rectangular brown tower base with vertical window details BELOW the clock from Image 2 must be visible, with a little background margin under the bottom edge. The first wide version cropped away this lower tower base and lower clock area. Correct that cropping.
Copy the central source faithfully without redesigning it: all FIVE characters exactly as in Image 2, their faces, poses, body proportions, outlines, clothing, full legs and shoes; Forest and フォレスト text at the top in the same font and arrangement; the complete source clock face, Roman numerals, mossy masonry and lower tower. No stretching or squeezing. Do not enlarge the central group enough to clip any source content. Do not add any new text, characters, buildings, objects or decorative labels. Keep copyright attribution. Output a crisp seamless banner around 2.8:1, not a page mockup.

