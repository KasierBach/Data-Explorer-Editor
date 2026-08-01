import { describe, expect, it } from 'vitest';
import { getAvatarLayout } from './AvatarEditor';

describe('getAvatarLayout', () => {
    it('covers the crop and keeps normalized panning inside its bounds', () => {
        expect(getAvatarLayout({
            width: 800,
            height: 400,
            viewportSize: 200,
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
        })).toEqual({
            width: 400,
            height: 200,
            left: -100,
            top: 0,
        });

        expect(getAvatarLayout({
            width: 800,
            height: 400,
            viewportSize: 200,
            zoom: 1,
            offsetX: 1,
            offsetY: -1,
        }).left).toBe(0);
    });
});
